package com.kagein.springbff.account;

import com.kagein.springbff.client.PythonFindMyClient;
import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.security.CredentialCipher;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final PythonFindMyClient pythonFindMyClient;
    private final FmAccountRepository fmAccountRepository;
    private final CredentialCipher credentialCipher;

    public AccountController(
            PythonFindMyClient pythonFindMyClient,
            FmAccountRepository fmAccountRepository,
            CredentialCipher credentialCipher) {
        this.pythonFindMyClient = pythonFindMyClient;
        this.fmAccountRepository = fmAccountRepository;
        this.credentialCipher = credentialCipher;
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> register(@RequestBody RegisterAccountRequest request) {
        String status = pythonFindMyClient.login(request.appleId(), request.password());
        FmAccount account = FmAccount.builder()
                .appleId(request.appleId())
                .encryptedPassword(credentialCipher.encrypt(request.password()))
                .status("active".equals(status) ? AccountStatus.ACTIVE : AccountStatus.PENDING_2FA)
                .createdAt(Instant.now())
                .build();
        fmAccountRepository.save(account);
        return ResponseEntity.ok(Map.of("status", status));
    }

    @PostMapping("/{appleId}/2fa")
    public ResponseEntity<Map<String, String>> submit2fa(
            @PathVariable String appleId, @RequestBody TwoFaRequest request) {
        FmAccount account = fmAccountRepository.findByAppleId(appleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        pythonFindMyClient.submit2fa(appleId, request.code());
        account.setStatus(AccountStatus.ACTIVE);
        fmAccountRepository.save(account);
        return ResponseEntity.ok(Map.of("status", "active"));
    }
}
