package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.paperreader.dto.*
import org.paperreader.exception.InvalidParameterException
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.AiChat
import org.paperreader.model.AiMessage
import org.paperreader.repository.AiChatRepository
import org.paperreader.repository.AiMessageRepository
import org.slf4j.LoggerFactory
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono

@Service
class AiChatService(
    private val aiChatRepository: AiChatRepository,
    private val aiMessageRepository: AiMessageRepository,
    private val objectMapper: ObjectMapper,
) {
    private val logger = LoggerFactory.getLogger(AiChatService::class.java)

    companion object {
        private val MODEL_CONFIGS = mapOf(
            "openai" to ModelConfig("OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL"),
            "claude" to ModelConfig("CLAUDE_API_KEY", "CLAUDE_BASE_URL", "CLAUDE_MODEL"),
            "deepseek" to ModelConfig("DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL", "DEEPSEEK_MODEL"),
            "qwen" to ModelConfig("QWEN_API_KEY", "QWEN_BASE_URL", "QWEN_MODEL"),
        )
    }

    private data class ModelConfig(
        val apiKeyEnv: String,
        val baseUrlEnv: String,
        val modelEnv: String,
    )

    @Transactional
    fun createChat(request: CreateChatRequest, userId: Long): AiChatDetailDto {
        val chat = aiChatRepository.save(
            AiChat(
                userId = userId,
                paperId = request.paperId,
                model = request.model,
                title = request.title,
            )
        )
        if (!request.message.isNullOrBlank()) {
            aiMessageRepository.save(AiMessage(chatId = chat.id, role = "user", content = request.message))
        }
        return chat.toDetailDto(emptyList())
    }

    @Transactional
    fun sendMessage(
        chatId: Long,
        userId: Long,
        request: ChatRequest,
        effectiveModel: String?,
    ): AiChatDetailDto {
        val chat = aiChatRepository.findById(chatId)
            .orElseThrow { ResourceNotFoundException("Chat", chatId) }
        require(chat.userId == userId) { "Not your chat" }

        val model = effectiveModel ?: chat.model

        // Save user message
        aiMessageRepository.save(AiMessage(chatId = chat.id, role = "user", content = request.message))

        // Get chat history
        val history = aiMessageRepository.findByChatIdOrderByCreatedAtAsc(chat.id)

        // Call AI
        val response = callAi(model, history)

        // Save assistant response
        val assistantMessage = aiMessageRepository.save(
            AiMessage(chatId = chat.id, role = "assistant", content = response)
        )

        val allMessages = history + assistantMessage
        return chat.toDetailDto(allMessages)
    }

    fun listChats(userId: Long): List<AiChatListDto> =
        aiChatRepository.findByUserIdOrderByCreatedAtDesc(userId).map { chat ->
            AiChatListDto(id = chat.id, paperId = chat.paperId, model = chat.model, title = chat.title, createdAt = chat.createdAt)
        }

    fun getChat(chatId: Long, userId: Long): AiChatDetailDto {
        val chat = aiChatRepository.findById(chatId)
            .orElseThrow { ResourceNotFoundException("Chat", chatId) }
        require(chat.userId == userId) { "Not your chat" }
        val messages = aiMessageRepository.findByChatIdOrderByCreatedAtAsc(chat.id)
        return chat.toDetailDto(messages)
    }

    @Transactional
    fun deleteChat(chatId: Long, userId: Long) {
        val chat = aiChatRepository.findById(chatId)
            .orElseThrow { ResourceNotFoundException("Chat", chatId) }
        require(chat.userId == userId) { "Not your chat" }
        aiMessageRepository.deleteAll(aiMessageRepository.findByChatIdOrderByCreatedAtAsc(chatId))
        aiChatRepository.delete(chat)
    }

    private fun callAi(model: String, history: List<AiMessage>): String {
        val config = MODEL_CONFIGS[model]
            ?: throw InvalidParameterException("Unsupported AI model: $model")

        val apiKey = System.getenv(config.apiKeyEnv) ?: ""
        val baseUrl = System.getenv(config.baseUrlEnv) ?: ""
        val modelName = System.getenv(config.modelEnv) ?: model

        require(apiKey.isNotBlank()) { "${config.apiKeyEnv} is not configured" }
        require(baseUrl.isNotBlank()) { "${config.baseUrlEnv} is not configured" }

        val messages = history.map { msg ->
            mapOf("role" to msg.role, "content" to msg.content)
        }

        val requestBody = mapOf(
            "model" to modelName,
            "messages" to messages,
        )

        return try {
            val client = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer $apiKey")
                .build()

            val response = client.post()
                .uri("/v1/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono<Map<String, Any>>()
                .block()
                ?: throw RuntimeException("Empty AI response")

            @Suppress("UNCHECKED_CAST")
            val choices = response["choices"] as? List<Map<String, Any>>
                ?: throw RuntimeException("No choices in AI response")

            @Suppress("UNCHECKED_CAST")
            val message = choices.first()["message"] as? Map<String, Any>
                ?: throw RuntimeException("No message in AI choice")

            message["content"] as? String ?: ""
        } catch (e: Exception) {
            if (e is InvalidParameterException) throw e
            logger.error("AI call failed for model {}: {}", model, e.message)
            throw RuntimeException("AI service error: ${e.message}")
        }
    }

    private fun AiChat.toDetailDto(messages: List<AiMessage>) = AiChatDetailDto(
        id = id, paperId = paperId, model = model, title = title,
        messages = messages.map { AiMessageDto(it.id, it.role, it.content, it.createdAt) },
        createdAt = createdAt,
    )
}
