package org.paperreader

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class PaperReaderApplication

fun main(args: Array<String>) {
    runApplication<PaperReaderApplication>(*args)
}
