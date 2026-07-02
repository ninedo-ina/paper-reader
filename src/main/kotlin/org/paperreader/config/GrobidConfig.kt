package org.paperreader.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Configuration

@Configuration
@ConfigurationProperties(prefix = "app.grobid")
class GrobidConfig {
    lateinit var baseUrl: String
    var timeout: Long = 60000
}
