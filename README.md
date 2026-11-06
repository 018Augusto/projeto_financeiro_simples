<img width="1918" height="858" alt="image" src="https://github.com/user-attachments/assets/ec933f6f-ca11-4de4-88f3-959690057843" />
Meu Planejamento Financeiro

Site simples para organizar o salário do mês. Você digita quanto recebe, divide o dinheiro em **períodos** (com datas) e coloca os **gastos** de cada período. O site mostra na hora quanto já foi planejado e quanto ainda sobra.

Feito só com HTML, CSS e JavaScript puro. Não precisa instalar nada e funciona sem internet.

## O que o site faz

O site tem três telas, todas na mesma página. Só a tela muda, sem abrir outras abas.

1. **Salário:** você informa o valor que tem para organizar.
2. **Planejar:** você cria períodos, escolhe as datas e adiciona os gastos (nome e valor). No topo aparecem o salário, o total planejado e o que sobra, com uma barra de progresso.
3. **Resumo:** mostra o total de cada período e quanto do salário vai para cada tipo de gasto, em reais e em porcentagem.

### Recursos

- Períodos com data de início e fim (o novo período já começa na data final do anterior).
- Gastos com nome livre, com sugestões prontas como Alimentação, Lazer e Emergências e imprevistos.
- Avisos simples: dinheiro sobrando, dinheiro planejado a mais que o salário e data final antes da inicial.
- Gastos com o mesmo nome em períodos diferentes são somados no resumo.
- Botão **Ver exemplo** que carrega um plano de R$ 200 dividido em dois períodos.
- Confirmação antes de apagar um período ou apagar tudo.
- Os dados ficam salvos no navegador (`localStorage`), então continuam ali quando você fecha e abre a página.

## Como usar

1. Baixe ou clone o projeto:
   ```bash
   git clone https://github.com/018Augusto/projeto_financeiro_git.git
   ```
2. Abra a pasta no VS Code.
3. Abra o arquivo `index.html` no navegador (duplo clique) ou use a extensão **Live Server** do VS Code.

Troque `NOME-DO-REPOSITORIO` pelo nome que você deu ao projeto no GitHub.

## Estrutura do projeto

```
planejamento/
├── index.html   # estrutura das três telas
├── style.css    # visual simples da página
└── script.js    # lógica: telas, cálculos, resumo e salvamento
```

## Tecnologias

- HTML5
- CSS3
- JavaScript (sem bibliotecas)

## Sobre os dados salvos

Tudo o que você digita fica guardado **somente no seu navegador**, no seu computador. Nada é enviado para a internet.

- Se você limpar os dados do navegador, o plano será apagado.
- Se abrir o site em outro navegador ou outro computador, ele começa vazio.
- Para recomeçar do zero, use o botão **Apagar tudo** na tela de resumo.

## Autor

Feito por **Gabriel Augusto** ([@018Augusto](https://github.com/018Augusto)).
