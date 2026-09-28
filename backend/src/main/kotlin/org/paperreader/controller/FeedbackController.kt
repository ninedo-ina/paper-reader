package org.paperreader.controller

import org.paperreader.dto.ApiResponse
import org.paperreader.dto.FeedbackDto
import org.paperreader.security.UserPrincipal
import org.paperreader.service.FeedbackService
import org.springframework.http.MediaType
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

/**
 * 问题反馈。登录用户才能提交（`SecurityConfig` 的 `anyRequest().authenticated()` 已覆盖本路径）。
 * 页面路径/版本/语言由客户端随表单带上；UA 取请求头，不信任客户端自报。
 */
@RestController
@RequestMapping("/api/feedback")
class FeedbackController(
    private val feedbackService: FeedbackService,
) {
    @PostMapping(consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun submit(
        @RequestParam("title") title: String,
        @RequestParam("content") content: String,
        @RequestParam("pagePath", required = false) pagePath: String?,
        @RequestParam("appVersion", required = false) appVersion: String?,
        @RequestParam("locale", required = false) locale: String?,
        @RequestParam("screenshots", required = false) screenshots: List<MultipartFile>?,
        @RequestHeader(value = "User-Agent", required = false) userAgent: String?,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<FeedbackDto> = ApiResponse(
        data = feedbackService.submit(
            userId = principal.userId,
            title = title,
            content = content,
            pagePath = pagePath,
            appVersion = appVersion,
            locale = locale,
            userAgent = userAgent,
            screenshots = screenshots,
        ),
    )
}
