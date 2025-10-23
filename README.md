# Test Frontières

Petit projet pour visualiser les frontières d'un pays, simplifier la géométrie, cliquer pour connaître le pays, et écouter un son pendant le glissement de la souris qui varie en fonction de la distance à la frontière.

Prérequis
- Python 3.8+
- PowerShell (Windows)

Installation
1. Créez un environnement virtuel et installez les dépendances:

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1; python -m pip install -r requirements.txt
```

Exécution

```powershell
# OPTIONNEL: définir le pays (par défaut France)
$env:COUNTRY_NAME = 'France'
python main.py
```

Ouvrir dans le navigateur: http://127.0.0.1:5000

Notes
- Le script utilise Overpass puis Nominatim en fallback pour récupérer la géométrie GeoJSON du pays. Selon le pays et la disponibilité d'Overpass, la requête peut durer quelques secondes.
- La simplification est faite côté serveur avec Shapely.
- Le front-end utilise Leaflet et Turf.js pour les calculs géographiques, WebAudio pour le son et SpeechSynthesis pour la voix.
- Le comportement de son pendant le drag: plus la souris est éloignée de la frontière, plus le son est aigu (pitch augmente), volume maintenu bas.
