package org.paperreader.dto

/**
 * 提交反馈后的回执。只回 id 与截图张数——本轮没有查看页，服务器路径不回传给客户端。
 */
data class FeedbackDto(
    val id: Long,
    val screenshotCount: Int,
)
