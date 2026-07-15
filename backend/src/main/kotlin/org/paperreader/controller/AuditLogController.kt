package org.paperreader.controller

import org.paperreader.dto.ApiResponse
import org.paperreader.security.UserPrincipal
import org.paperreader.service.AuditLogService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/audit-logs")
class AuditLogController(
    private val auditLogService: AuditLogService,
) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal principal: UserPrincipal,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): ApiResponse<*> = ApiResponse(data = auditLogService.list(principal.userId, page, size))
}
