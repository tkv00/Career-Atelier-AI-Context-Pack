# Atelier Cat QA notes

- All nine animation rows are generated and extracted into 57 frames.
- `running-right` was regenerated after the first source showed a cyan gradient and floor band.
- `running-left` is a deterministic framewise mirror of the repaired rightward gait. The collar and centered round tag make this derivation identity-safe.
- `inspect_frames.py`: passed with zero errors and zero warnings.
- Atlas contract: 1536×1872 RGBA, 8 columns × 9 rows, 192×208 cells.
- `validate_atlas.py`: passed with zero transparent RGB residue pixels.
- Contact sheet and all nine GIF previews were rendered and visually reviewed.
- The packaged `spritesheet.webp` is integrated into the web UI with five color treatments and state-aware animations.
