package com.kagein.springbff.security;

import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.security.SecureRandom;

import static org.assertj.core.api.Assertions.assertThat;

class CredentialCipherTest {

    private static String randomBase64Key() {
        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        return Base64.getEncoder().encodeToString(key);
    }

    @Test
    void encryptsAndDecryptsRoundTrip() {
        CredentialCipher cipher = new CredentialCipher(randomBase64Key());

        String encrypted = cipher.encrypt("hunter2");

        assertThat(encrypted).isNotEqualTo("hunter2");
        assertThat(cipher.decrypt(encrypted)).isEqualTo("hunter2");
    }

    @Test
    void sameInputProducesDifferentCiphertextEachTime() {
        CredentialCipher cipher = new CredentialCipher(randomBase64Key());

        String first = cipher.encrypt("hunter2");
        String second = cipher.encrypt("hunter2");

        assertThat(first).isNotEqualTo(second);
    }
}
