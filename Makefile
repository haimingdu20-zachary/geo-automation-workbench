.PHONY: dev test install-skills

dev:
	python3 app/server.py --open

test:
	PYTHONPYCACHEPREFIX=/tmp/geo-workbench-pycache python3 -m unittest discover -s tests -v

install-skills:
	python3 scripts/install_skills.py
