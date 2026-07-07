package com.kagein.springbff.account;

import com.kagein.springbff.client.PythonFindMyClient;
import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.security.CredentialCipher;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "dashboard.username=admin",
        "dashboard.password-hash=$2b$12$VpWzC70E7trgMpdIAIkigec3g4mw3/ranR5b42nXnhEK0raSjE5Tm",
        "credential.encryption-key=MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="
})
class AccountControllerTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PythonFindMyClient pythonFindMyClient;

    @MockitoBean
    private FmAccountRepository fmAccountRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void registerAccountPersistsActiveStatus() throws Exception {
        when(pythonFindMyClient.login("user@example.com", "hunter2")).thenReturn("active");
        when(fmAccountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/accounts")
                        .with(httpBasic("admin", "hunter2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RegisterAccountRequest("user@example.com", "hunter2"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("active"));

        verify(fmAccountRepository).save(argThat(account ->
                account.getAppleId().equals("user@example.com")
                        && account.getStatus() == AccountStatus.ACTIVE
                        && !account.getEncryptedPassword().equals("hunter2")));
    }

    @Test
    void registerAccountPersistsPending2faStatus() throws Exception {
        when(pythonFindMyClient.login(anyString(), anyString())).thenReturn("2fa_required");
        when(fmAccountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/accounts")
                        .with(httpBasic("admin", "hunter2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RegisterAccountRequest("user@example.com", "hunter2"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("2fa_required"));
    }

    @Test
    void submit2faUpdatesStoredAccountToActive() throws Exception {
        FmAccount pending = FmAccount.builder()
                .id(1L)
                .appleId("user@example.com")
                .encryptedPassword("irrelevant")
                .status(AccountStatus.PENDING_2FA)
                .build();
        when(fmAccountRepository.findByAppleId("user@example.com")).thenReturn(Optional.of(pending));
        when(fmAccountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/accounts/user@example.com/2fa")
                        .with(httpBasic("admin", "hunter2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new TwoFaRequest("123456"))))
                .andExpect(status().isOk());

        verify(pythonFindMyClient).submit2fa("user@example.com", "123456");
        verify(fmAccountRepository).save(argThat(account -> account.getStatus() == AccountStatus.ACTIVE));
    }
}
