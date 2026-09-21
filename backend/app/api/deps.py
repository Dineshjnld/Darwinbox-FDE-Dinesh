from fastapi import Request


def service(request: Request):
    return request.app.state.migration_service


def store(request: Request):
    return request.app.state.store

