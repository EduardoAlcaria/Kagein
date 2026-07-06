class InvalidCredentialsError(Exception):
    pass


class TwoFactorRequiredError(Exception):
    def __init__(self, apple_id: str):
        self.apple_id = apple_id
        super().__init__(f"2FA required for {apple_id}")
