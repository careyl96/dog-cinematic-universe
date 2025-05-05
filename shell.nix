{pkgs ? import <nixpkgs> {}}:
pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs
    yarn
    git
    vtsls
    nodePackages.prettier
  ];
}
