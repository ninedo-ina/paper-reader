package org.paperreader.controller

import org.paperreader.dto.ApiResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class HealthController {

    @GetMapping("/health")
    fun health(): ApiResponse<Map<String, String>> = ApiResponse(
        data = mapOf("status" to "ok", "version" to "0.1.0"),
    )
}
