from pathlib import Path

from app import cookies


def test_cookie_directory_for_is_stable(tmp_path, monkeypatch):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))

    first = cookies.cookie_directory_for("user@example.com")
    second = cookies.cookie_directory_for("user@example.com")

    assert first == second
    assert Path(first).is_dir()
    assert Path(first).parent == tmp_path


def test_cookie_directory_for_differs_per_account(tmp_path, monkeypatch):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))

    a = cookies.cookie_directory_for("a@example.com")
    b = cookies.cookie_directory_for("b@example.com")

    assert a != b


def test_cookie_directory_for_is_case_insensitive(tmp_path, monkeypatch):
    monkeypatch.setenv("COOKIE_ROOT", str(tmp_path))

    mixed_case = cookies.cookie_directory_for("User@Example.com")
    lower_case = cookies.cookie_directory_for("user@example.com")

    assert mixed_case == lower_case
