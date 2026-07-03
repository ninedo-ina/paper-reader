package org.paperreader.security

data class UserPrincipal(
    val userId: Long,
    val email: String,
)
