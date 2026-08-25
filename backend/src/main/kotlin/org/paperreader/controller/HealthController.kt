package org.paperreader.controller

import org.paperreader.dto.ApiResponse
import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.info.BuildProperties
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class HealthController(
    private val buildPropertiesProvider: ObjectProvider<BuildProperties>,
) {

    @GetMapping("/health")
    fun health(): ApiResponse<Map<String, String>> = ApiResponse(
        data = mapOf(
            "status" to "ok",
            "version" to (buildPropertiesProvider.getIfAvailable()?.version ?: DEVELOPMENT_VERSION),
        ),
    )

    private companion object {
        const val DEVELOPMENT_VERSION = "development"
    }
}
