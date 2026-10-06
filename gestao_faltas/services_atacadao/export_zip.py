"""Serviço de compactação em lote de arquivos PDF em ZIP."""
import os
import zipfile
from typing import List


def create_batch_zip(pdf_paths: List[str], output_zip_path: str) -> str:
    """Compacta uma lista de caminhos de PDFs em um único arquivo ZIP."""
    os.makedirs(os.path.dirname(os.path.abspath(output_zip_path)), exist_ok=True)
    with zipfile.ZipFile(output_zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zip_file:
        for pdf_path in pdf_paths:
            if os.path.exists(pdf_path):
                arcname = os.path.basename(pdf_path)
                zip_file.write(pdf_path, arcname=arcname)
    return output_zip_path
