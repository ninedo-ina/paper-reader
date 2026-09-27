package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.paperreader.config.ContentProperties
import org.paperreader.dto.*
import org.paperreader.exception.ContentTooLargeException
import org.paperreader.exception.ContentVersionConflictException
import org.paperreader.exception.InvalidParameterException
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.Paper
import org.paperreader.model.PaperTag
import org.paperreader.repository.PaperRepository
import org.paperreader.repository.PaperTagRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.time.Instant

@Service
class PaperService(
    private val paperRepository: PaperRepository,
    private val paperTagRepository: PaperTagRepository,
    private val fileStorageService: FileStorageService,
    private val paperParsingService: PaperParsingService,
    private val objectMapper: ObjectMapper,
    private val auditLogService: AuditLogService,
    private val uploadQuotaService: UploadQuotaService,
    private val contentProperties: ContentProperties,
) {
    /**
     * 上传 PDF。单文件大小与三个口径的额度都必须在上传动作之前判掉，落盘成功后才记台账。
     * Spring 的 multipart 上限（10MB）是第一道防线，这里再判一次，保证任何入口都过同一套规则。
     */
    @Transactional
    fun uploadPdf(file: MultipartFile, userId: Long, title: String?): PaperDetailDto {
        val fileSize = file.size
        uploadQuotaService.checkFileSize(fileSize)
        uploadQuotaService.checkQuota(userId, fileSize)

        val paperTitle = title ?: file.originalFilename?.removeSuffix(".pdf") ?: "Untitled"

        val paper = paperRepository.save(
            Paper(
                userId = userId,
                title = paperTitle,
                sourceType = "UPLOAD",
                filePath = "",
                fileSize = fileSize,
            )
        )

        val filePath = fileStorageService.store(file, userId, paper.id)
        val stored = paperRepository.save(paper.copy(filePath = filePath, parseStatus = "PENDING"))
        uploadQuotaService.record(userId, stored.id, fileSize)
        paperParsingService.requestParse(stored)
        val result = stored.toDetailDto()
        auditLogService.log(userId, "上传论文", result.title)
        return result
    }

    /**
     * 从 URL 导入。大小要下载完才知道，所以额度判两次：下载前先按 0 字节探一次
     * （已经超额就别浪费带宽去下），拿到实际大小后再判一次。
     * 单文件 10MB 由 storeFromUrl 在下载过程中截断，不会把超大响应读进内存。
     */
    @Transactional
    fun uploadFromUrl(request: UploadFromUrlRequest, userId: Long): PaperDetailDto {
        uploadQuotaService.checkQuota(userId, 0)

        val paper = paperRepository.save(
            Paper(
                userId = userId,
                title = request.title ?: "Paper from URL",
                sourceType = "URL",
                sourceUrl = request.url,
                filePath = "",
                fileSize = 0,
            )
        )

        val (filePath, pdfBytes) = fileStorageService.storeFromUrl(
            request.url, userId, paper.id, UploadQuotaService.MAX_FILE_BYTES,
        )
        val fileSize = pdfBytes.size.toLong()
        uploadQuotaService.checkQuota(userId, fileSize)
        val stored = paperRepository.save(
            paper.copy(filePath = filePath, fileSize = fileSize, parseStatus = "PENDING")
        )
        uploadQuotaService.record(userId, stored.id, fileSize)
        paperParsingService.requestParse(stored)
        val result = stored.toDetailDto()
        auditLogService.log(userId, "上传论文", result.title)
        return result
    }

    @Transactional
    fun createPaper(request: CreatePaperRequest, userId: Long): PaperDetailDto {
        require(request.title.isNotBlank()) { "Title is required" }
        val paper = paperRepository.save(
            Paper(
                userId = userId,
                title = request.title,
                authors = request.authors,
                participants = request.participants,
                abstractText = request.abstractText,
                category = request.category ?: "JOURNAL",
                extraFields = request.extraFields?.let { objectMapper.writeValueAsString(it) },
                storageConfigId = request.storageConfigId,
                sourceType = "MANUAL",
                sourceUrl = null,
                filePath = null,
                pageCount = 0,
                fileSize = 0,
            )
        )
        val result = paper.toDetailDto()
        auditLogService.log(userId, "创建论文", result.title)
        return result
    }

    fun getPaper(id: Long, userId: Long): PaperDetailDto {
        val paper = paperRepository.findByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("Paper", id)
        val tags = paperTagRepository.findByPaperId(paper.id).map { it.tag }
        return paper.toDetailDto(tags)
    }

    fun listPapers(userId: Long, page: Int, pageSize: Int, sourceTypes: List<String>? = null, favorite: Boolean? = null): PageResponse<PaperListDto> {
        val pageRequest = PageRequest.of(page, pageSize)
        val result = when {
            favorite != null && !sourceTypes.isNullOrEmpty() ->
                paperRepository.findByUserIdAndFavoriteAndSourceTypeInOrderByCreatedAtDesc(userId, favorite, sourceTypes, pageRequest)
            favorite != null ->
                paperRepository.findByUserIdAndFavoriteOrderByCreatedAtDesc(userId, favorite, pageRequest)
            !sourceTypes.isNullOrEmpty() ->
                paperRepository.findByUserIdAndSourceTypeInOrderByCreatedAtDesc(userId, sourceTypes, pageRequest)
            else ->
                paperRepository.findByUserIdOrderByCreatedAtDesc(userId, pageRequest)
        }
        val paperIds = result.content.map { it.id }
        val tagsMap = paperTagRepository.findByPaperIdIn(paperIds).groupBy({ it.paperId }, { it.tag })
        return PageResponse(
            items = result.content.map { it.toListDto(tagsMap[it.id] ?: emptyList()) },
            total = result.totalElements,
            page = page,
            pageSize = pageSize,
        )
    }

    fun downloadPaper(id: Long, userId: Long): Pair<String, ByteArray> {
        val paper = paperRepository.findByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("Paper", id)
        val filePath = paper.filePath
            ?: throw IllegalArgumentException("This paper has no downloadable file")
        val bytes = fileStorageService.read(filePath)
        auditLogService.log(userId, "下载", paper.title)
        return "${paper.title}.pdf" to bytes
    }

    fun downloadPaperAsResource(id: Long, userId: Long): Pair<String, org.springframework.core.io.Resource> {
        val paper = paperRepository.findByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("Paper", id)
        val filePath = paper.filePath
            ?: throw IllegalArgumentException("This paper has no downloadable file")
        val resource = fileStorageService.readAsResource(filePath)
        auditLogService.log(userId, "下载", paper.title)
        return "${paper.title}.pdf" to resource
    }

    @Transactional
    fun updatePaper(id: Long, userId: Long, request: UpdatePaperRequest): PaperDetailDto {
        val paper = paperRepository.findForUpdateByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("Paper", id)

        val updated = paper.copy(
            title = request.title ?: paper.title,
            authors = request.authors ?: paper.authors,
            participants = request.participants ?: paper.participants,
            abstractText = request.abstractText ?: paper.abstractText,
            category = request.category ?: paper.category,
            extraFields = request.extraFields?.let { objectMapper.writeValueAsString(it) } ?: paper.extraFields,
            doi = request.doi ?: paper.doi,
            year = request.year ?: paper.year,
            journal = request.journal ?: paper.journal,
            updatedAt = Instant.now(),
        )
        val saved = paperRepository.save(updated)
        val tags = paperTagRepository.findByPaperId(saved.id).map { it.tag }
        auditLogService.log(userId, "保存论文", saved.title)
        return saved.toDetailDto(tags)
    }

    /**
     * 读取正文。正文与元数据是两条独立的路径：这里只动 content_* 列，
     * abstractText（摘要）永远不会被这里的返回或写入影响。
     *
     * 读取硬上限（app.content.max-readable-bytes）：正常写作碰不到，它挡的是闸门上线之前
     * 写进来的历史大正文——一次 GET 就把整串读进内存再解析成 JsonNode，是可以被反复触发的放大面。
     * 不在这里返回 413，而是显式说明「只读不写」，用户仍能用别的方式取回并自行删减。
     */
    fun getPaperContent(id: Long, userId: Long): PaperContentDto {
        val paper = paperRepository.findByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("Paper", id)
        val storedBytes = paper.contentJson?.let { utf8Length(it) } ?: 0L
        if (storedBytes > contentProperties.maxReadableBytes) {
            throw ContentTooLargeException(storedBytes, contentProperties.maxReadableBytes, "正文（读取）")
        }
        return paper.toContentDto()
    }

    /** 正文体积与快照保留策略，供前端本地预检（服务端仍是唯一权威）。 */
    fun contentLimits(): ContentLimitsDto = ContentLimitsDto(
        maxJsonBytes = contentProperties.maxJsonBytes,
        maxHtmlBytes = contentProperties.maxHtmlBytes,
        maxReadableBytes = contentProperties.maxReadableBytes,
        maxSnapshotCount = contentProperties.maxSnapshotCount,
        maxSnapshotAgeDays = contentProperties.maxSnapshotAgeDays,
    )

    /**
     * 保存正文（PUT 语义：整篇覆盖）。加悲观锁，避免并发保存下后写者读到陈旧版本号。
     * contentVersion 每次保存自增，供前端判断自己写的是第几版。
     * 若请求带了 baseVersion（保存前读到的版本），且已落后于当前版本，说明有别的会话
     * 已经写过——拒绝这次后写覆盖并抛 409，让前端明确告知用户而不是静默盖掉别人的改动。
     *
     * ## 写放大控制（W9）
     * 自动保存是防抖后的**整篇覆盖**：编辑器里点一下加粗又撤销、拖一下选区后回退、
     * 或前端防抖窗口重叠，都会送上来一份与库里逐字节相同的正文。这种请求如果照常落库，
     * 就白白换来一次整行重写 + WAL + 版本号自增 + 一条审计日志——版本号自增尤其有害，
     * 它会让另一个正在编辑的会话凭空撞出 409。
     * 因此先比内容再写：内容与 contentHtml 都没变时直接返回当前状态，不写库、不动版本号、不记审计。
     *
     * 体积闸门：contentJson / contentHtml 各有上限（app.content.*），超限抛 1014/413。
     * 放在写之前、锁之后——先写后判会留下垃圾数据，锁前判则要在拿到锁后再判一次。
     */
    @Transactional
    fun updatePaperContent(id: Long, userId: Long, request: UpdatePaperContentRequest): PaperContentDto {
        val body = request.contentJson
        if (body == null || !body.isObject) {
            throw InvalidParameterException("contentJson must be a JSON object")
        }
        val paper = paperRepository.findForUpdateByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("Paper", id)

        val currentVersion = paper.contentVersion ?: 0
        if (request.baseVersion != null && request.baseVersion != currentVersion) {
            throw ContentVersionConflictException(currentVersion)
        }

        val json = body.toString()
        ensureWithin(json, contentProperties.maxJsonBytes, "正文")
        request.contentHtml?.let { ensureWithin(it, contentProperties.maxHtmlBytes, "正文渲染结果") }

        if (json == paper.contentJson && request.contentHtml == paper.contentHtml) {
            return paper.toContentDto()
        }

        val saved = paperRepository.save(
            paper.copy(
                contentJson = json,
                contentHtml = request.contentHtml,
                contentVersion = currentVersion + 1,
                updatedAt = Instant.now(),
            )
        )
        auditLogService.log(userId, "保存正文", saved.title)
        return saved.toContentDto()
    }

    /** 超限即 1014/413。字节数按 UTF-8 计——中文一字 3 字节，按字符数判会漏掉三分之二。 */
    private fun ensureWithin(value: String, limitBytes: Long, field: String) {
        val actual = utf8Length(value)
        if (actual > limitBytes) {
            throw ContentTooLargeException(actual, limitBytes, field)
        }
    }

    /**
     * UTF-8 字节数。用编码长度而非 `String.length`（UTF-16 码元数）：两者对纯 ASCII 相同，
     * 但中文、emoji、阿拉伯文下差得多，而正文恰恰以这些为主。
     * 不调 `toByteArray().size`——那会为一次判定额外复制一整份正文。
     */
    private fun utf8Length(value: String): Long {
        var bytes = 0L
        var i = 0
        while (i < value.length) {
            val c = value[i]
            bytes += when {
                c.code < 0x80 -> 1
                c.code < 0x800 -> 2
                // 代理对（emoji 等增补平面字符）占 4 字节，且必须是成对的两个 char
                Character.isHighSurrogate(c) && i + 1 < value.length &&
                    Character.isLowSurrogate(value[i + 1]) -> {
                    i++
                    4
                }
                else -> 3
            }
            i++
        }
        return bytes
    }

    @Transactional
    fun toggleFavorite(id: Long, userId: Long, favorite: Boolean): PaperDetailDto {
        val paper = paperRepository.findForUpdateByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("Paper", id)
        val updated = paper.copy(favorite = favorite, updatedAt = Instant.now())
        val saved = paperRepository.save(updated)
        val tags = paperTagRepository.findByPaperId(saved.id).map { it.tag }
        auditLogService.log(userId, if (favorite) "收藏" else "取消收藏", saved.title)
        return saved.toDetailDto(tags)
    }

    fun listTags(paperId: Long, userId: Long): List<PaperTagDto> {
        val paper = paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        return paperTagRepository.findByPaperId(paper.id).map { it.toDto() }
    }

    @Transactional
    fun addTag(paperId: Long, userId: Long, tag: String): PaperTagDto {
        require(tag.isNotBlank()) { "Tag cannot be empty" }
        require(tag.length <= 100) { "Tag must be 100 characters or less" }
        val paper = paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        val existing = paperTagRepository.findByPaperIdAndTag(paper.id, tag)
        if (existing != null) return existing.toDto()
        val result = paperTagRepository.save(PaperTag(paperId = paper.id, tag = tag)).toDto()
        auditLogService.log(userId, "标签", paper.title)
        return result
    }

    @Transactional
    fun removeTag(paperId: Long, userId: Long, tag: String) {
        val paper = paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        paperTagRepository.deleteByPaperIdAndTag(paper.id, tag)
    }

    fun sharePaper(paperId: Long, userId: Long, description: String?): SharePaperResponse {
        val paper = paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)

        val url = paper.doi?.let { "https://doi.org/$it" } ?: paper.sourceUrl ?: ""
        val parts = mutableListOf<String>()
        if (!description.isNullOrBlank()) parts.add(description)
        parts.add(paper.title)
        if (url.isNotBlank()) parts.add(url)

        auditLogService.log(userId, "分享", paper.title)
        return SharePaperResponse(shareText = parts.joinToString(" — "))
    }

    private fun Paper.toDetailDto(tags: List<String> = emptyList()) = PaperDetailDto(
        id = id,
        title = title,
        authors = authors,
        abstractText = abstractText,
        participants = participants,
        doi = doi,
        year = year,
        journal = journal,
        category = category,
        extraFields = extraFields?.let { objectMapper.readValue(it, Map::class.java) as Map<String, Any?> },
        storageConfigId = storageConfigId,
        favorite = favorite,
        sourceType = sourceType,
        sourceUrl = sourceUrl,
        hasOriginalFile = !filePath.isNullOrBlank(),
        pageCount = pageCount,
        fileSize = fileSize,
        grobidResult = null,
        parseStatus = parseStatus,
        parseError = parseError,
        tags = tags,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    private fun Paper.toContentDto() = PaperContentDto(
        paperId = id,
        contentJson = contentJson?.let { objectMapper.readTree(it) },
        contentHtml = contentHtml,
        contentVersion = contentVersion ?: 0,
        updatedAt = updatedAt,
    )

    private fun Paper.toListDto(tags: List<String> = emptyList()) = PaperListDto(
        id = id,
        title = title,
        authors = authors,
        doi = doi,
        year = year,
        journal = journal,
        category = category,
        sourceType = sourceType,
        hasOriginalFile = !filePath.isNullOrBlank(),
        pageCount = pageCount,
        favorite = favorite,
        tags = tags,
        createdAt = createdAt,
    )

    private fun PaperTag.toDto() = PaperTagDto(
        id = id,
        paperId = paperId,
        tag = tag,
        createdAt = createdAt,
    )
}
