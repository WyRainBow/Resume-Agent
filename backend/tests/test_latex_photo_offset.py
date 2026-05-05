from backend.latex_generator import json_to_latex


def test_photo_x_offset_is_applied_after_image_in_right_aligned_box():
    resume = {
        "name": "测试用户",
        "photo": "https://example.com/photo.jpg",
        "photoOffsetX": 1.5,
        "photoOffsetY": -2,
        "photoWidthCm": 3,
        "photoHeightCm": 3,
        "contact": {},
        "sectionOrder": [],
    }

    latex = json_to_latex(resume, [])
    photo_line = next(line for line in latex.splitlines() if "{photo}" in line)

    assert "\\includegraphics" in photo_line
    assert "\\hspace*{1.50cm}" in photo_line
    assert photo_line.index("\\includegraphics") < photo_line.index("\\hspace*{1.50cm}")
