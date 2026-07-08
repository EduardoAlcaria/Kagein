package com.kagein.springbff.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// ponytail: @SpringBootTest boots the full app context (JPA + Flyway), which needs a
// real Postgres — same Testcontainers setup as SpringBffApplicationTests/FmAccountRepositoryTest.
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "dashboard.username=admin",
        // bcrypt hash of "hunter2", generated for this test only (the brief's original
        // hash didn't actually match "hunter2" — verified with bcrypt.checkpw before replacing)
        "dashboard.password-hash=$2b$12$VpWzC70E7trgMpdIAIkigec3g4mw3/ranR5b42nXnhEK0raSjE5Tm"
})
class SecurityConfigTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthEndpointIsPubliclyReachable() throws Exception {
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    @Test
    void apiEndpointRejectsUnauthenticatedRequest() throws Exception {
        mockMvc.perform(get("/api/people")).andExpect(status().isUnauthorized());
    }

    @Test
    void apiEndpointRejectsWrongPassword() throws Exception {
        mockMvc.perform(get("/api/people").with(httpBasic("admin", "wrong")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void apiEndpointAcceptsCorrectCredentials() throws Exception {
        mockMvc.perform(get("/api/people").with(httpBasic("admin", "hunter2")))
                .andExpect(status().isOk());
    }
}
