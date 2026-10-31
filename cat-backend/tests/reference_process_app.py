"""Test-only executable: real API/worker processes, synthetic inference adapters.

Never imported by production. All paths/credentials must point to a test fixture.
"""
import os
from pathlib import Path
import sys
import time

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
root = Path(os.environ['REFERENCE_TEST_ROOT'])

from app.services import model_loader, detector

model_loader.MODEL_PATH = root / 'weights.pt'
model_loader.TORCH_AVAILABLE = True
detector._MODEL_PATH = root / 'detector.pt'
detector.YOLO_AVAILABLE = True


def extract(image, **kwargs):
    deadline = time.monotonic() + 90
    while (root / 'block').exists():
        if time.monotonic() > deadline:
            raise RuntimeError('Test inference wait timed out')
        time.sleep(.05)
    if (root / 'fail').exists():
        return []
    return [1.0] + [0.0] * 255


model_loader.extract_embedding = extract
detector.detect_and_crop = lambda image, **kwargs: image

if sys.argv[1] == 'serve':
    import uvicorn
    from app.main import app

    @app.middleware('http')
    async def test_pid(request, call_next):
        response = await call_next(request)
        response.headers['X-Test-Process'] = str(os.getpid())
        return response

    uvicorn.run(app, host='127.0.0.1', port=int(sys.argv[2]), log_level='warning', access_log=False)
else:
    from app.services import reference_lifecycle
    original_write = reference_lifecycle.atomic_json

    def fault_write(path, value):
        original_write(path, value)
        if path.name == 'current.json' and (root / 'crash-after-pointer').exists():
            os._exit(77)  # Real process death after publication, before journal completion.

    reference_lifecycle.atomic_json = fault_write
    sys.path.insert(0, str(BACKEND / 'scripts'))
    from reference_jobs import main
    sys.argv = ['reference_jobs.py', 'worker', '--once']
    raise SystemExit(main())
