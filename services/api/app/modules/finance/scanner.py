"""Malware scanning integration for uploaded finance transfer slips (M1.4).

- Scans raw image bytes before persistence.
- Rejects infected uploads (`400 malware_detected`).
- Fails closed in production if scanner is unavailable (`503 finance_scanner_unavailable`).
- Development and test stubs allow deterministic verification.
"""

import socket
import struct
from typing import Protocol


class MalwareDetected(Exception):
    """The uploaded file contains malware or a dangerous virus signature."""


class ScannerUnavailable(Exception):
    """The malware scanner is unconfigured or temporarily unreachable."""


class MalwareScanner(Protocol):
    def scan(self, data: bytes) -> None:
        """Scan data bytes. Raises MalwareDetected or ScannerUnavailable."""
        ...


class UnavailableScanner:
    """Production fallback when no scanner daemon is configured; fails closed."""

    def scan(self, data: bytes) -> None:
        raise ScannerUnavailable("finance_scanner_unavailable")


class ClamAVScanner:
    """Scan an in-memory upload through clamd's bounded INSTREAM protocol."""

    def __init__(self, host: str, port: int, timeout_seconds: float) -> None:
        self.host = host
        self.port = port
        self.timeout_seconds = timeout_seconds

    def scan(self, data: bytes) -> None:
        try:
            with socket.create_connection((self.host, self.port), timeout=self.timeout_seconds) as connection:
                connection.settimeout(self.timeout_seconds)
                connection.sendall(b"zINSTREAM\0")
                for start in range(0, len(data), 64 * 1024):
                    chunk = data[start : start + 64 * 1024]
                    connection.sendall(struct.pack("!I", len(chunk)))
                    connection.sendall(chunk)
                connection.sendall(struct.pack("!I", 0))
                response_bytes = bytearray()
                while len(response_bytes) < 4096:
                    part = connection.recv(4096 - len(response_bytes))
                    if not part:
                        break
                    response_bytes += part
                    if b"\0" in part:
                        break
                response = bytes(response_bytes).rstrip(b"\0\r\n").decode("utf-8", errors="replace")
        except (OSError, TimeoutError) as err:
            raise ScannerUnavailable("finance_scanner_unavailable") from err

        if response.endswith(" OK"):
            return
        if response.endswith(" FOUND"):
            raise MalwareDetected("malware_detected")
        raise ScannerUnavailable("finance_scanner_unavailable")


# Standard EICAR test signature for testing malware detection without live viruses
EICAR_SIGNATURE = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


class DevScanner:
    """Development scanner: detects EICAR test string; otherwise permits."""

    def scan(self, data: bytes) -> None:
        if EICAR_SIGNATURE in data or b"MALWARE_TEST_STRING" in data:
            raise MalwareDetected("malware_detected")


class StubScanner:
    """Deterministic test scanner for unit and integration testing."""

    def __init__(self, infected: bool = False, fail_unavailable: bool = False) -> None:
        self.infected = infected
        self.fail_unavailable = fail_unavailable

    def scan(self, data: bytes) -> None:
        if self.fail_unavailable:
            raise ScannerUnavailable("finance_scanner_unavailable")
        if self.infected or EICAR_SIGNATURE in data or b"MALWARE_TEST_STRING" in data:
            raise MalwareDetected("malware_detected")
