package com.kagein.springbff.me;

import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.repository.PersonLocationRepository;
import com.kagein.springbff.repository.PersonRepository;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "dashboard.username=admin",
        "dashboard.password-hash=$2b$12$VpWzC70E7trgMpdIAIkigec3g4mw3/ranR5b42nXnhEK0raSjE5Tm",
        "credential.encryption-key=MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="
})
class MeControllerTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired private MockMvc mockMvc;
    @Autowired private FmAccountRepository fmAccountRepository;
    @Autowired private PersonRepository personRepository;
    @Autowired private PersonLocationRepository personLocationRepository;

    @BeforeEach
    void clean() {
        personLocationRepository.deleteAll();
        personRepository.deleteAll();
        fmAccountRepository.deleteAll();
    }

    private Long seedAccount() {
        return fmAccountRepository.save(FmAccount.builder().appleId("a@icloud.com")
                .encryptedPassword("x").status(AccountStatus.ACTIVE).createdAt(Instant.now()).build()).getId();
    }

    @Test
    void createsSelfPersonAndLocation() throws Exception {
        Long accountId = seedAccount();

        mockMvc.perform(post("/api/me/location").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"latitude\":-23.56,\"longitude\":-46.65}"))
                .andExpect(status().isNoContent());

        var self = personRepository.findByFmAccountIdAndExternalId(accountId, "self");
        assertThat(self).isPresent();
        assertThat(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(self.get().getId())).hasSize(1);
    }

    @Test
    void reusesSelfPersonOnSecondUpdate() throws Exception {
        Long accountId = seedAccount();

        mockMvc.perform(post("/api/me/location").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"latitude\":-23.56,\"longitude\":-46.65}"))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/me/location").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"latitude\":-23.57,\"longitude\":-46.64}"))
                .andExpect(status().isNoContent());

        assertThat(personRepository.findAll()).hasSize(1);
        Long selfId = personRepository.findByFmAccountIdAndExternalId(accountId, "self").get().getId();
        assertThat(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(selfId)).hasSize(2);
    }

    @Test
    void conflictsWhenNoAccount() throws Exception {
        mockMvc.perform(post("/api/me/location").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"latitude\":-23.56,\"longitude\":-46.65}"))
                .andExpect(status().isConflict());
    }
}
