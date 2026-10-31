import json
from unittest.mock import Mock

from scripts import eval_recognition
from app.schemas import RecognizeResponse


def test_eval_calls_current_contract_and_exports_predictions(tmp_path, monkeypatch):
    (tmp_path/'cat').mkdir()
    (tmp_path/'cat'/'one.png').write_bytes(b'test-image')
    output = tmp_path/'result.json'
    recognize = Mock(return_value=RecognizeResponse(status='confirmed', cat_id=1, cat_name='cat', confidence=0.8))
    monkeypatch.setattr(eval_recognition, 'recognize_cat_image', recognize)
    monkeypatch.setattr('sys.argv', ['eval', '--crops-dir', str(tmp_path), '--no-crop', '--output', str(output)])
    assert eval_recognition.main() == 0
    assert recognize.call_args.kwargs['crop'] is False
    result = json.loads(output.read_text(encoding='utf-8'))
    assert result['summary']['top1'] == 1
    assert len(result['predictions']) == 1


def test_unavailable_does_not_report_a_successful_evaluation(tmp_path, monkeypatch):
    (tmp_path/'cat').mkdir()
    (tmp_path/'cat'/'one.png').write_bytes(b'test-image')
    monkeypatch.setattr(eval_recognition, 'recognize_cat_image', lambda *a, **kw: RecognizeResponse(status='unavailable', confidence=0))
    monkeypatch.setattr('sys.argv', ['eval', '--crops-dir', str(tmp_path)])
    assert eval_recognition.main() == 2
