from unittest.mock import Mock

from PIL import Image
import pytest

from app.services import detector
from app.services.artifact_hash import sha256_file


@pytest.fixture
def local_detector(tmp_path, monkeypatch):
    path = tmp_path / 'detector.pt'
    model = Mock(return_value=[])
    factory = Mock(return_value=model)
    monkeypatch.setattr(detector, '_MODEL_PATH', path)
    monkeypatch.setattr(detector, '_model', None)
    monkeypatch.setattr(detector, '_model_digest', None)
    monkeypatch.setattr(detector, 'YOLO_AVAILABLE', True)
    monkeypatch.setattr(detector, 'YOLO', factory)
    return path, model, factory


def test_missing_detector_does_not_auto_download(local_detector):
    _, _, factory = local_detector
    assert detector._load_model() is None
    factory.assert_not_called()
    with pytest.raises(RuntimeError, match='does not match'):
        detector.detect_and_crop(Image.new('RGB', (16, 16)), expected_digest='f' * 64)


def test_detector_replacement_and_wrong_digest(local_detector):
    path, model, factory = local_detector
    path.write_bytes(b'first')
    first_digest = sha256_file(path)
    image = Image.new('RGB', (16, 16))
    assert detector.detect_and_crop(image, expected_digest=first_digest) is image
    path.write_bytes(b'second')
    with pytest.raises(RuntimeError, match='does not match'):
        detector.detect_and_crop(image, expected_digest=first_digest)
    assert model.call_count == 1
    assert factory.call_count == 2


def test_detector_error_does_not_silently_change_pipeline(local_detector):
    path, model, _ = local_detector
    path.write_bytes(b'checkpoint')
    model.side_effect = RuntimeError('inference failed')
    with pytest.raises(RuntimeError, match='inference failed'):
        detector.detect_and_crop(Image.new('RGB', (16, 16)), expected_digest=sha256_file(path))
