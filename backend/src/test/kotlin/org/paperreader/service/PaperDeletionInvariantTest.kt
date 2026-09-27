package org.paperreader.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.paperreader.repository.AnnotationRepository
import org.paperreader.repository.NoteRepository
import org.paperreader.repository.PaperContentVersionRepository
import org.paperreader.repository.PaperVersionRepository
import org.paperreader.repository.ReadingLogRepository
import org.springframework.core.io.support.PathMatchingResourcePatternResolver

/**
 * 删除论文的「不留残渣」不变量（W9 验收标准：删除论文后数据库中不再残留正文/快照/协作房间记录）。
 *
 * 这条验收标准没法靠"再写一遍删除代码"来满足——正文是 pr_papers 的一列，随行消失；
 * 而需求里点名的「快照」表由 W6 落地为 pr_paper_content_versions（已在本测试登记），
 * 「协作房间」表属于 W7、**当前还不存在**。
 * 真正会出事的时刻是将来：W7 加了协作房间表，忘了写 ON DELETE CASCADE、
 * 也忘了往 PaperDeletionService 里加一行，于是删除论文后这些表里静静留着别人的草稿正文
 * ——而且没有任何测试会红。
 *
 * 所以这里把不变量钉在**迁移文件**上：扫描 db/migration 下所有指向 pr_papers(id) 的外键，
 * 其所属表必须满足二者之一：
 *  1. 外键带 ON DELETE CASCADE（数据库层兜底）；或
 *  2. 在下面的显式清理清单里，且该表对应的仓库声明了 deleteByPaperId（服务层清理）。
 * 都不满足 → 这个测试红。它不验证删除逻辑写得对不对（那是 PaperDeletionServiceTest 的事），
 * 它验证的是**新表不可能被悄悄漏掉**。
 */
class PaperDeletionInvariantTest {

    /**
     * 外键指向 pr_papers 但**没有** CASCADE 的表：删除论文时必须由 PaperDeletionService 显式清理。
     * 清单项 = 表名 to 该表的删除入口（仓库类型），名字里的 deleteByPaperId 会经反射校验确实存在，
     * 防止清单和仓库脱节。新增这类表时，除了往这里登记，还要在 PaperDeletionService 里真的调用它。
     */
    private val explicitlyCleaned: Map<String, Class<*>> = mapOf(
        "pr_annotations" to AnnotationRepository::class.java,
        "pr_notes" to NoteRepository::class.java,
        "pr_reading_logs" to ReadingLogRepository::class.java,
        "pr_paper_versions" to PaperVersionRepository::class.java,
        // V19（W6 正文快照）。它就是这个测试想防的那种表：外键指向 pr_papers、无 CASCADE、
        // 行里装的是整篇正文。W6 落地时已在 PaperDeletionService 里显式清理，
        // 这里把它登记下来，好让「清单和仓库脱节」这条断言继续有意义。
        "pr_paper_content_versions" to PaperContentVersionRepository::class.java,
    )

    private val referencesPapers = Regex("""REFERENCES\s+pr_papers\s*\(\s*id\s*\)""", RegexOption.IGNORE_CASE)
    private val createTable = Regex("""CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)""", RegexOption.IGNORE_CASE)
    private val alterTable = Regex("""ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)""", RegexOption.IGNORE_CASE)

    /** 从迁移文件解析出来的「外键指向 pr_papers」的表 → 是否带 ON DELETE CASCADE。 */
    private fun fkTablesToPapers(): Map<String, Boolean> {
        val migrations = PathMatchingResourcePatternResolver().getResources("classpath:db/migration/V*.sql")
        assertTrue(migrations.isNotEmpty(), "没有找到任何迁移文件，测试前提不成立")

        val tables = mutableMapOf<String, Boolean>()
        migrations.forEach { resource ->
            // 按语句切分：一次只看一条 DDL，避免跨表误判。
            resource.file.readText().split(";").forEach { statement ->
                val referenceLine = statement.lineSequence().firstOrNull { it.contains(referencesPapers) }
                    ?: return@forEach
                // 外键可能内联在 CREATE TABLE 里，也可能由 ALTER TABLE 单独挂上，两种都要认。
                val table = createTable.find(statement)?.groupValues?.get(1)
                    ?: alterTable.find(statement)?.groupValues?.get(1)
                    ?: return@forEach
                tables[table] = referenceLine.uppercase().contains("ON DELETE CASCADE")
            }
        }
        return tables
    }

    @Test
    fun `每张外键指向 pr_papers 的表要么级联删除要么在显式清理清单里`() {
        val unhandled = fkTablesToPapers()
            .filter { (table, cascade) -> !cascade && table !in explicitlyCleaned }
            .keys

        assertTrue(
            unhandled.isEmpty(),
            "以下表的外键指向 pr_papers，却没有 ON DELETE CASCADE，也不在显式清理清单里：$unhandled。" +
                "删除论文后它们会留下残渣（正文/快照/协作房间）。" +
                "请在迁移里加 ON DELETE CASCADE，或把表加进 PaperDeletionService 的清理并登记到本测试的 explicitlyCleaned。",
        )
    }

    @Test
    fun `显式清理清单里的表确实存在且有删除入口`() {
        val fkTables = fkTablesToPapers()

        val stale = explicitlyCleaned.keys - fkTables.keys
        assertTrue(stale.isEmpty(), "清理清单里的表在迁移里已经找不到了，请同步删除：$stale")

        val wronglyListed = explicitlyCleaned.filterKeys { fkTables[it] == true }.keys
        assertTrue(wronglyListed.isEmpty(), "这些表已有 ON DELETE CASCADE，不必留在显式清理清单：$wronglyListed")

        explicitlyCleaned.forEach { (table, repository) ->
            assertTrue(
                repository.methods.any { it.name == "deleteByPaperId" },
                "$table 对应的 ${repository.simpleName} 没有 deleteByPaperId，PaperDeletionService 清理不了这张表",
            )
        }
    }

    @Test
    fun `正文列随 pr_papers 行一起删除`() {
        // 正文（content_json / content_html）不是独立表，而是 pr_papers 的列（V16）。
        // 这条断言把「不单独建正文表」写成契约：一旦有人把正文拆成子表，
        // 上面那张外键表扫描会自动把它揪出来（除非它老实写了 CASCADE 并想清楚语义）。
        val v16 = PathMatchingResourcePatternResolver()
            .getResources("classpath:db/migration/V16__paper_content.sql")
            .first().file.readText()
        assertTrue(v16.contains("ALTER TABLE pr_papers"), "正文必须是 pr_papers 的列，而不是独立子表")
        assertTrue(v16.contains("content_json"), "V16 应当给 pr_papers 加 content_json 列")

        assertEquals(
            setOf("pr_paper_content_versions"),
            fkTablesToPapers().keys.filter { it.contains("content") }.toSet(),
            "出现了以正文命名、外键指向 pr_papers 的子表：请确认它已级联或已显式清理，" +
                "并来本测试更新这份「已知的正文子表」清单",
        )
    }
}
