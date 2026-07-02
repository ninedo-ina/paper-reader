package org.paperreader.controller

import jakarta.validation.Valid
import org.paperreader.dto.ApiResponse
import org.paperreader.dto.LoginRequest
import org.paperreader.dto.RegisterRequest
import org.paperreader.dto.TokenResponse
import org.paperreader.service.AuthService
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService,
) {

    @PostMapping("/register")
    fun register(@Valid @RequestBody request: RegisterRequest): ApiResponse<TokenResponse> =
        ApiResponse(data = authService.register(request))

    @PostMapping("/login")
    fun login(@Valid @RequestBody request: LoginRequest): ApiResponse<TokenResponse> =
        ApiResponse(data = authService.login(request))
}
