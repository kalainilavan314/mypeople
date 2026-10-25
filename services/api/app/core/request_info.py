from fastapi import Request


def client_ip(request: Request) -> str:
    """The client address, for sign-in limits and the audit log.

    X-Forwarded-For is not read here: a client can put any address in it.
    Behind Nginx, run uvicorn with --proxy-headers
    --forwarded-allow-ips=<nginx address>; uvicorn then takes the address
    Nginx appended, which the client cannot forge.
    """
    return request.client.host if request.client else "unknown"
