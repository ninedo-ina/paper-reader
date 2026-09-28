package org.paperreader.model

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

/**
 * 用户提交的问题反馈。见 V21__feedback.sql。
 * 只增不删，没有后台查看页；截图字节在磁盘上，[screenshots] 只存元数据 JSON 数组。
 */
@Entity
@Table(name = "pr_feedbacks")
data class Feedback(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(nullable = false, length = 200)
    val title: String,

    @Column(nullable = false, columnDefinition = "TEXT")
    val content: String,

    @Column(name = "page_path", length = 500)
    val pagePath: String? = null,

    @Column(name = "app_version", length = 50)
    val appVersion: String? = null,

    @Column(name = "user_agent", length = 500)
    val userAgent: String? = null,

    @Column(length = 20)
    val locale: String? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    val screenshots: String? = null,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
