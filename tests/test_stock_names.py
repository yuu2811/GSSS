"""Tests for analyzers.stock_names module."""

from analyzers.stock_names import search_stocks, get_name_by_code, _CODE_INDEX


class TestGetNameByCode:
    def test_known_code(self):
        assert get_name_by_code("7203") == "トヨタ自動車"

    def test_with_suffix(self):
        assert get_name_by_code("7203.T") == "トヨタ自動車"

    def test_unknown_code(self):
        assert get_name_by_code("0000") is None

    def test_empty_code(self):
        assert get_name_by_code("") is None


class TestSearchStocks:
    def test_exact_code_match(self):
        results = search_stocks("7203")
        assert len(results) >= 1
        assert results[0] == ("7203", "トヨタ自動車")

    def test_code_with_suffix(self):
        results = search_stocks("7203.T")
        assert len(results) >= 1
        assert results[0][0] == "7203"

    def test_prefix_code_match(self):
        results = search_stocks("720")
        assert any(code.startswith("720") for code, _ in results)

    def test_name_search_exact(self):
        results = search_stocks("トヨタ")
        assert any("トヨタ" in name for _, name in results)

    def test_name_search_alias(self):
        results = search_stocks("TOYOTA")
        assert any("7203" == code for code, _ in results)

    def test_name_search_partial(self):
        results = search_stocks("ソニー")
        assert any("6758" == code for code, _ in results)

    def test_empty_query(self):
        assert search_stocks("") == []

    def test_whitespace_query(self):
        assert search_stocks("   ") == []

    def test_max_results(self):
        results = search_stocks("7", max_results=3)
        assert len(results) <= 3

    def test_no_duplicates(self):
        results = search_stocks("トヨタ")
        codes = [code for code, _ in results]
        assert len(codes) == len(set(codes))


class TestCodeIndex:
    def test_index_built(self):
        assert len(_CODE_INDEX) > 0
        assert "7203" in _CODE_INDEX

    def test_index_values(self):
        name, aliases = _CODE_INDEX["7203"]
        assert name == "トヨタ自動車"
        assert "トヨタ" in aliases
