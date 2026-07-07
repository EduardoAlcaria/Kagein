package com.kagein.springbff.client;

public class PythonFindMyException extends RuntimeException {
    private final int statusCode;

    public PythonFindMyException(int statusCode, String message) {
        super(message);
        this.statusCode = statusCode;
    }

    public int getStatusCode() {
        return statusCode;
    }
}
