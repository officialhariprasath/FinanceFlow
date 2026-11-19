"""Display code formatting for customer/loan prefixes."""

from backend.app.utils.display_codes import format_display_code, normalize_padding, normalize_prefix


def test_format_pads_to_four():
    assert format_display_code("VMFL", 1, 4) == "VMFL0001"
    assert format_display_code("VMFC", 50, 4) == "VMFC0050"
    assert format_display_code("VMFL", 9999, 4) == "VMFL9999"


def test_format_grows_past_padding():
    assert format_display_code("VMFL", 10000, 4) == "VMFL10000"
    assert format_display_code("VMFC", 100000, 3) == "VMFC100000"


def test_normalize_prefix_uppercases():
    assert normalize_prefix("vmfc", "VMFC") == "VMFC"
    assert normalize_prefix(None, "VMFL") == "VMFL"


def test_normalize_padding_min_three():
    assert normalize_padding(4) == 4
    assert normalize_padding(3) == 3
    try:
        normalize_padding(2)
        assert False, "expected ValueError"
    except ValueError:
        pass
