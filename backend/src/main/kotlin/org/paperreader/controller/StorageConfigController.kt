package org.paperreader.controller

import org.paperreader.dto.*
import org.paperreader.security.UserPrincipal
import org.paperreader.service.StorageConfigService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/storage-configs")
class StorageConfigController(
    private val storageConfigService: StorageConfigService,
) {
    @PostMapping
    fun create(
        @RequestBody request: CreateStorageConfigRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<StorageConfigDto> =
        ApiResponse(data = storageConfigService.create(principal.userId, request))

    @GetMapping
    fun list(
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<List<StorageConfigDto>> =
        ApiResponse(data = storageConfigService.list(principal.userId))

    @GetMapping("/{id}")
    fun get(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<StorageConfigDto> =
        ApiResponse(data = storageConfigService.getById(id, principal.userId))

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @RequestBody request: UpdateStorageConfigRequest,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<StorageConfigDto> =
        ApiResponse(data = storageConfigService.update(id, principal.userId, request))

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: Long,
        @AuthenticationPrincipal principal: UserPrincipal,
    ): ApiResponse<Nothing> {
        storageConfigService.delete(id, principal.userId)
        return ApiResponse(message = "Deleted")
    }
}
