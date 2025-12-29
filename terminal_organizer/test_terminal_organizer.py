from __future__ import annotations

import io
import os
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from terminal_organizer.cli import find_project, main, parse_tags
from terminal_organizer.config import AppConfig
from terminal_organizer.models import Project, deserialize_projects, serialize_projects
from terminal_organizer.storage import BoardStorage


class TestCliHelpers(unittest.TestCase):
    def test_parse_tags_splits_dedupes_and_normalizes(self) -> None:
        self.assertEqual(parse_tags(None), [])
        self.assertEqual(parse_tags([]), [])
        self.assertEqual(parse_tags(["One, two", "two", " THREE "]), ["one", "three", "two"])
        self.assertEqual(parse_tags(["", " ,  , "]), [])

    def test_find_project_matches_id_name_and_substring(self) -> None:
        p1 = Project(name="Alpha Project", repo_path="/tmp/a", status="Backlog", id="abc12345")
        p2 = Project(name="Beta", repo_path="/tmp/b", status="Done", id="def67890")
        projects = [p1, p2]

        self.assertIs(find_project(projects, "abc12345"), p1)
        self.assertIs(find_project(projects, "BETA"), p2)
        self.assertIs(find_project(projects, "alpha"), p1)  # substring match
        self.assertIsNone(find_project(projects, "missing"))


class TestModels(unittest.TestCase):
    def test_project_to_dict_normalizes_tags(self) -> None:
        p = Project(name="X", repo_path="/x", status="Backlog", tags=[" A ", "b", "a", ""])
        payload = p.to_dict()
        self.assertEqual(payload["tags"], ["a", "b"])

    def test_serialize_deserialize_roundtrip(self) -> None:
        p = Project(
            id="deadbeef",
            name="Roundtrip",
            repo_path="/repo",
            status="In Progress",
            priority=2,
            tags=["Tag", "tag", "  other "],
            notes="hello\nworld",
            created_at="2025-01-01T00:00:00+00:00",
            updated_at="2025-01-02T00:00:00+00:00",
        )
        blob = serialize_projects([p])
        loaded = deserialize_projects(blob)
        self.assertEqual(len(loaded), 1)
        self.assertEqual(loaded[0].id, "deadbeef")
        self.assertEqual(loaded[0].name, "Roundtrip")
        self.assertEqual(loaded[0].normalized_tags(), ["other", "tag"])

    def test_deserialize_empty_blob(self) -> None:
        self.assertEqual(deserialize_projects(""), [])
        self.assertEqual(deserialize_projects("   \n"), [])


class TestStorage(unittest.TestCase):
    def test_upsert_and_delete_by_id(self) -> None:
        with tempfile.TemporaryDirectory(prefix="terminal_organizer_test_") as td:
            store_path = Path(td) / "projects.json"
            storage = BoardStorage(store_path)

            p1 = Project(name="One", repo_path="/one", status="Backlog", id="oneone11")
            p2 = Project(name="Two", repo_path="/two", status="Done", id="twotwo22")

            storage.upsert(p1)
            storage.upsert(p2)
            loaded = storage.load()
            self.assertEqual({p.id for p in loaded}, {"oneone11", "twotwo22"})

            # Upsert should replace by id
            p1_new = Project(name="One!", repo_path="/one", status="Backlog", id="oneone11")
            storage.upsert(p1_new)
            loaded = {p.id: p for p in storage.load()}
            self.assertEqual(loaded["oneone11"].name, "One!")

            self.assertTrue(storage.delete("twotwo22"))
            self.assertFalse(storage.delete("twotwo22"))
            self.assertEqual([p.id for p in storage.load()], ["oneone11"])


class TestCliIntegration(unittest.TestCase):
    def test_cli_add_list_info_move_update_delete_by_name(self) -> None:
        with tempfile.TemporaryDirectory(prefix="terminal_organizer_cli_test_") as td:
            data_path = str(Path(td) / "store.json")

            # Ensure env doesn't leak into the test run.
            old_data = os.environ.get("TERMINAL_ORGANIZER_DATA")
            old_statuses = os.environ.get("TERMINAL_ORGANIZER_STATUSES")
            try:
                os.environ["TERMINAL_ORGANIZER_DATA"] = data_path
                os.environ["TERMINAL_ORGANIZER_STATUSES"] = "Backlog,In Progress,Done"

                out = io.StringIO()
                with redirect_stdout(out):
                    rc = main(["add", "--name", "My Project", "--path", "/repo", "--status", "Backlog", "--priority", "2", "--tag", "A,B", "--notes", "hi"])
                self.assertEqual(rc, 0)

                # list should show 1 project
                out = io.StringIO()
                with redirect_stdout(out):
                    rc = main(["list"])
                self.assertEqual(rc, 0)
                self.assertIn("1 project(s) shown.", out.getvalue())
                self.assertIn("MY PROJECT", out.getvalue().upper())

                # info by name should work
                out = io.StringIO()
                with redirect_stdout(out):
                    rc = main(["info", "My Project"])
                self.assertEqual(rc, 0)
                self.assertIn("Name      : My Project", out.getvalue())

                # move by name should work
                out = io.StringIO()
                with redirect_stdout(out):
                    rc = main(["move", "My Project", "--status", "In Progress"])
                self.assertEqual(rc, 0)
                self.assertIn("Moved 'My Project' to In Progress.", out.getvalue())

                # update by name should work
                out = io.StringIO()
                with redirect_stdout(out):
                    rc = main(["update", "My Project", "--priority", "1", "--tag", "C"])
                self.assertEqual(rc, 0)
                self.assertIn("Updated project 'My Project'.", out.getvalue())

                # delete by name should work (regression test for prior behavior)
                out = io.StringIO()
                with redirect_stdout(out):
                    rc = main(["delete", "My Project"])
                self.assertEqual(rc, 0)
                self.assertIn("Project deleted.", out.getvalue())

                # list should show 0 projects now
                out = io.StringIO()
                with redirect_stdout(out):
                    rc = main(["list"])
                self.assertEqual(rc, 0)
                self.assertIn("0 project(s) shown.", out.getvalue())
            finally:
                if old_data is None:
                    os.environ.pop("TERMINAL_ORGANIZER_DATA", None)
                else:
                    os.environ["TERMINAL_ORGANIZER_DATA"] = old_data
                if old_statuses is None:
                    os.environ.pop("TERMINAL_ORGANIZER_STATUSES", None)
                else:
                    os.environ["TERMINAL_ORGANIZER_STATUSES"] = old_statuses


class TestConfig(unittest.TestCase):
    def test_from_env_parses_statuses_and_store_path(self) -> None:
        with tempfile.TemporaryDirectory(prefix="terminal_organizer_cfg_test_") as td:
            store = str(Path(td) / "x" / "projects.json")
            old_data = os.environ.get("TERMINAL_ORGANIZER_DATA")
            old_statuses = os.environ.get("TERMINAL_ORGANIZER_STATUSES")
            try:
                os.environ["TERMINAL_ORGANIZER_DATA"] = store
                os.environ["TERMINAL_ORGANIZER_STATUSES"] = "A, ,B"
                cfg = AppConfig.from_env()
                self.assertEqual(cfg.statuses, ["A", "B"])
                self.assertEqual(str(cfg.store_path), str(Path(store).expanduser().resolve()))
            finally:
                if old_data is None:
                    os.environ.pop("TERMINAL_ORGANIZER_DATA", None)
                else:
                    os.environ["TERMINAL_ORGANIZER_DATA"] = old_data
                if old_statuses is None:
                    os.environ.pop("TERMINAL_ORGANIZER_STATUSES", None)
                else:
                    os.environ["TERMINAL_ORGANIZER_STATUSES"] = old_statuses


if __name__ == "__main__":
    unittest.main()

