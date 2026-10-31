from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.services import model_loader


@pytest.fixture
def loader(monkeypatch, tmp_path):
    path = tmp_path / 'weights.pt'
    monkeypatch.setattr(model_loader, 'MODEL_PATH', path)
    monkeypatch.setattr(model_loader, '_model', None)
    monkeypatch.setattr(model_loader, '_model_digest', None)
    monkeypatch.setattr(model_loader, 'TORCH_AVAILABLE', True)
    monkeypatch.setattr(model_loader, 'TIMM_AVAILABLE', True)
    model = Mock()
    model.load_state_dict.return_value = ([], [])
    monkeypatch.setattr(model_loader, 'DINOv3WithProjection', lambda backbone: model, raising=False)
    factory = Mock(return_value=Mock())
    monkeypatch.setattr(model_loader, 'timm', SimpleNamespace(create_model=factory), raising=False)
    load = Mock(return_value={'model': {'weight': 'stub'}})
    monkeypatch.setattr(model_loader, 'torch', SimpleNamespace(load=load), raising=False)
    return path, model, factory, load


def test_missing_weights_never_construct_a_random_model(loader):
    _, _, factory, _ = loader
    assert model_loader.load_model() is None
    factory.assert_not_called()


@pytest.mark.parametrize('failure', ['corrupt', 'dimensions', 'missing_keys'])
def test_invalid_weights_do_not_mark_model_ready(loader, failure):
    path, model, _, load = loader
    path.write_bytes(b'test-checkpoint')
    if failure == 'corrupt': load.side_effect = ValueError('corrupt')
    elif failure == 'dimensions': model.load_state_dict.side_effect = RuntimeError('dimension mismatch')
    else: model.load_state_dict.return_value = (['projection.weight'], [])
    assert model_loader.load_model() is None
    assert model_loader._model is None


def test_only_a_fully_loaded_model_is_cached(loader):
    path, model, factory, _ = loader
    path.write_bytes(b'test-checkpoint')
    assert model_loader.load_model() is model
    assert model_loader.load_model() is model
    factory.assert_called_once()
    assert model.load_state_dict.call_args.kwargs['strict'] is True


def test_changed_or_removed_checkpoint_invalidates_cached_model(loader):
    path, model, factory, load = loader
    path.write_bytes(b'first-checkpoint')
    assert model_loader.load_model() is model
    first_digest = model_loader._model_digest
    path.write_bytes(b'second-checkpoint')
    assert model_loader.load_model() is model
    assert model_loader._model_digest != first_digest
    assert factory.call_count == 2
    # The hash describes the exact bytes passed to torch, not a separate path read.
    assert load.call_args.args[0].getvalue() == b'second-checkpoint'
    path.unlink()
    assert model_loader.load_model() is None
    assert model_loader._model is None and model_loader._model_digest is None


def test_wrong_expected_model_never_runs_inference(loader):
    from PIL import Image
    path, model, _, _ = loader
    path.write_bytes(b'checkpoint')
    assert model_loader.extract_embedding(Image.new('RGB', (16, 16)), expected_digest='f' * 64) == []
    model.assert_not_called()
