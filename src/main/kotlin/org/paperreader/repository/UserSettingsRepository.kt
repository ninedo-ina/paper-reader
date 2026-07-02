package org.paperreader.repository

import org.paperreader.model.UserSettings
import org.springframework.data.jpa.repository.JpaRepository

interface UserSettingsRepository : JpaRepository<UserSettings, Long>
