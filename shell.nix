{pkgs ? import <nixpkgs> {}}:
pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs
    vtsls

    nodePackages.prettier
  ];
}
