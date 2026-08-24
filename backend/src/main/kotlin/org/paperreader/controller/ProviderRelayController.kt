package org.paperreader.controller

import org.paperreader.dto.ProviderRelayChatRequest
import org.paperreader.dto.ProviderRelayModelsRequest
import org.paperreader.service.ProviderRelayService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody

@RestController
@RequestMapping("/api/provider-relay")
class ProviderRelayController(
    private val providerRelayService: ProviderRelayService,
) {
    @PostMapping("/models")
    fun models(
        @RequestBody request: ProviderRelayModelsRequest,
    ): ResponseEntity<StreamingResponseBody> = providerRelayService.forwardModels(request)

    @PostMapping("/chat/completions")
    fun chatCompletions(
        @RequestBody request: ProviderRelayChatRequest,
    ): ResponseEntity<StreamingResponseBody> = providerRelayService.forwardChat(request)
}
