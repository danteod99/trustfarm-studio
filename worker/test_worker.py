"""Pruebas de los LoRA de estilo del worker. Uso, con un Python que tenga requests:
    python worker/test_worker.py
"""
import copy
import json
import os
import sys
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
os.environ["WORKER_CONFIG"] = str(AQUI / "config.example.json")

import worker  # noqa: E402

WF = json.loads((AQUI / "workflows" / "z_image.json").read_text(encoding="utf-8"))
LORAS = json.loads((AQUI / "config.example.json").read_text(encoding="utf-8"))["models"]["z-image"]["loras_estilo"]
PISTA = LORAS[0]["pista"]


def aplicar(prompt):
    return worker.aplicar_loras(copy.deepcopy(WF), prompt, LORAS)


class PistaDeEscena(unittest.TestCase):
    def test_un_prompt_de_granja_recibe_la_pista_al_final(self):
        wf, prompt = aplicar("Una granja de celulares en un cuarto oscuro")
        self.assertEqual(prompt, f"Una granja de celulares en un cuarto oscuro, {PISTA}")
        self.assertIn("lora_estilo_0", wf)

    def test_no_deja_puntuacion_ni_saltos_antes_de_la_pista(self):
        _, prompt = aplicar("Una granja de celulares, foto realista.\n")
        self.assertEqual(prompt, f"Una granja de celulares, foto realista, {PISTA}")

    def test_otro_tema_no_cambia_ni_el_prompt_ni_el_workflow(self):
        texto = "Gato astronauta flotando en el espacio.\n"
        wf, prompt = aplicar(texto)
        self.assertEqual(prompt, texto)
        self.assertEqual(wf, WF)

    def test_no_escribe_la_palabra_interna_en_el_prompt(self):
        _, prompt = aplicar("Una granja de celulares")
        self.assertNotIn("dntfarm", prompt.lower())

    def test_un_lora_sin_pista_deja_el_prompt_igual(self):
        sin_pista = [{k: v for k, v in LORAS[0].items() if k != "pista"}]
        wf, prompt = worker.aplicar_loras(copy.deepcopy(WF), "Una granja de celulares.", sin_pista)
        self.assertEqual(prompt, "Una granja de celulares.")
        self.assertIn("lora_estilo_0", wf)


if __name__ == "__main__":
    unittest.main()
