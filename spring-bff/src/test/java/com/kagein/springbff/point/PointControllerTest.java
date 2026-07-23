package com.kagein.springbff.point;

import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.repository.PointOfInterestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "dashboard.username=admin",
        "dashboard.password-hash=$2b$12$VpWzC70E7trgMpdIAIkigec3g4mw3/ranR5b42nXnhEK0raSjE5Tm",
        "credential.encryption-key=MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="
})
class PointControllerTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired private MockMvc mockMvc;
    @Autowired private FmAccountRepository fmAccountRepository;
    @Autowired private PointOfInterestRepository pointRepository;

    @BeforeEach
    void clean() {
        pointRepository.deleteAll();
        fmAccountRepository.deleteAll();
    }

    private void seedAccount() {
        fmAccountRepository.save(FmAccount.builder().appleId("a@icloud.com")
                .encryptedPassword("x").status(AccountStatus.ACTIVE).createdAt(Instant.now()).build());
    }

    @Test
    void createsAndListsAPoint() throws Exception {
        seedAccount();

        mockMvc.perform(post("/api/points").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"label\":\"Home\",\"latitude\":-23.56,\"longitude\":-46.65}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("Home"));

        mockMvc.perform(get("/api/points").with(httpBasic("admin", "hunter2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].label").value("Home"));
    }

    @Test
    void rejectsMissingCoordinates() throws Exception {
        seedAccount();

        mockMvc.perform(post("/api/points").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"label\":\"Home\"}"))
                .andExpect(status().isBadRequest());
    }
}
