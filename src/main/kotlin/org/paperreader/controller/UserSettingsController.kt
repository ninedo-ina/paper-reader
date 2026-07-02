package org.paperreader.controller

import org.paperreader.dto.*
import org.paperreader.model.UserSettings
import org.paperreader.repository.UserSettingsRepository
import org.paperreader.security.UserPrincipal
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import java.time.Instant

@RestController
@RequestMapping("/api/settings")
class UserSettingsController(
    private val userSettingsRepository: UserSettingsRepository,
) {
    @GetMapping
    fun get(
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<UserSettingsDto> {
        val settings = userSettingsRepository.findById(principal.userId)
            .orElse(UserSettings(userId = principal.userId))
        return ApiResponse(data = UserSettingsDto(
            theme = settings.theme,
            language = settings.language,
            defaultAiModel = settings.defaultAiModel,
        ))
    }

    @PutMapping
    fun update(
        @RequestBody request: UpdateUserSettingsRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<UserSettingsDto> {
        val existing = userSettingsRepository.findById(principal.userId)
            .orElse(UserSettings(userId = principal.userId))

        val updated = existing.copy(
            theme = request.theme ?: existing.theme,
            language = request.language ?: existing.language,
            defaultAiModel = request.defaultAiModel ?: existing.defaultAiModel,
            updatedAt = Instant.now(),
        )

        val saved = userSettingsRepository.save(updated)
        return ApiResponse(data = UserSettingsDto(
            theme = saved.theme,
            language = saved.language,
            defaultAiModel = saved.defaultAiModel,
        ))
    }
}
