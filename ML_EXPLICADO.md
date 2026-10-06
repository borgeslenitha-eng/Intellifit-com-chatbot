# O Machine Learning deste chatbot

## O que é aprendido

Um classificador aprende a relacionar frases em português com dez intenções: cadastrar, consumir, editar, excluir, consultar estoque, consultar validade, pedir receitas, pedir resumo, pedir ajuda e fora do escopo.

O modelo é **TF-IDF + regressão logística multiclasse**, treinado com scikit-learn. TF-IDF transforma palavras e pares de palavras em números; a regressão logística aprende pesos para separar as intenções. Os pesos são exportados para JSON e a previsão é executada no backend TypeScript, sem API externa.

Não é um modelo generativo e não aprende automaticamente com cada conversa.

## Dados e separação

- `backend/ml/dataset.csv`: 400 frases autorais, rotuladas manualmente; 40 por intenção. Não são conversas de usuários reais.
- Treino: 280 frases. Somente essa parte ajusta o vocabulário, IDF e pesos.
- Validação: 60 frases. Usada para escolher o limiar de aceitação.
- Teste: 60 frases. Usada para medir o desempenho do modelo exportado.
- `splits.json`: mostra exatamente quais frases pertencem a cada parte.
- Sementes fixas 42 e 43 tornam a separação reproduzível.

Não foram criadas métricas para parecer que o modelo acerta tudo. O primeiro modelo é uma base acadêmica pequena e tem limitações.

## Resultado medido do classificador isolado

| Medida | Resultado |
|---|---:|
| Acurácia no teste | 70,0% (42 de 60 frases) |
| F1 macro | 0,6935 |
| Limiar escolhido na validação | 0,50 |
| Margem mínima entre as duas primeiras intenções | 0,08 |
| Frações de teste aceitas pelo limiar e margem | 55,0% (33 de 60) |
| Acurácia entre previsões aceitas | 78,8% (26 de 33) |

Esses números pertencem ao **classificador isolado**, antes das regras complementares. Não são a porcentagem de sucesso de toda a aplicação. A matriz de confusão e os resultados por classe estão em `backend/ml/evaluation.json`.

As frases são da mesma fonte e podem compartilhar vocabulário. A divisão é por frase, não por autor ou família de paráfrases. Por isso, esse resultado interno não substitui avaliação com novos usuários. Os escores também não são probabilidades calibradas de que a resposta está correta.

## Como ML e regras trabalham juntos

1. Respostas a perguntas em andamento (unidade, confirmação, opção numerada) seguem o estado da conversa.
2. Botões e comandos explícitos de alteração, como “usei” e “excluir”, têm interpretação determinística para preservar o fluxo e as validações.
3. Para outras frases, o modelo prevê a intenção. Quando a pontuação e a diferença para a segunda opção são suficientes, essa intenção orienta a ação.
4. Se o modelo ficar incerto, regras de vocabulário do domínio podem reconhecer consultas claras de estoque, receitas ou validade. Caso contrário, o chat oferece opções e pede esclarecimento.
5. O backend extrai os dados, consulta o banco e pede confirmação antes de gravar qualquer alteração.

A resposta de `POST /api/chat` inclui `recognition`, com `source` (`ml`, `rule`, `command` ou `dialogue`), intenção e escore quando aplicável. Assim você pode demonstrar honestamente quando a decisão veio do modelo. A interface não precisa mostrar esses detalhes ao usuário.

Exemplo para demonstração: `balanço do estoque` é encaminhado pelo modelo à intenção de resumo. Você pode conferir o campo `recognition` pela aba Network do navegador ou por um cliente de API. A rota autenticada `GET /api/chat/model-info` mostra algoritmo, classes e limiares.

## O que continua sendo regra, não ML

- Calcular hoje, amanhã, mês que vem e meses por nome.
- Extrair quantidades e converter g/kg ou ml/l.
- Impedir estoque negativo, validar dados e confirmar gravações.
- Comparar ingredientes com o catálogo de receitas.
- Separar tomate fresco de molho de tomate.
- Formatar respostas e controlar as telas.

Essas partes complementam o classificador. Não devem ser apresentadas como algo que ele aprendeu.

## Executar e retreinar

O projeto já contém `backend/ml/model.json`. Para usar o chatbot, basta Node.js e PostgreSQL. **Python só é necessário se você quiser treinar novamente.**

Para reproduzir o treino, com Python 3.11 ou superior, na pasta `backend`:

```bat
python -m pip install -r ml/requirements.txt
python ml/train.py
npm test
```

Reinicie o backend depois de treinar, para carregar o novo JSON. O treino também atualiza métricas, separações e previsões de referência.

`tests/regressions.test.ts` compara os escores do TypeScript com os escores exportados pelo Python nas 60 frases de teste, verificando que o modelo executado é o mesmo que foi avaliado.

## Explicação para a apresentação

“O IntelliFit usa uma arquitetura híbrida de chatbot. Treinamos um classificador supervisionado com frases rotuladas para reconhecer intenções. O texto é representado com TF-IDF e classificado por regressão logística. O modelo foi separado em treino, validação e teste. A previsão orienta a conversa, enquanto regras fazem validação de dados, controle de contexto e operações seguras no banco. Quando a interpretação é incerta, o usuário recebe opções em vez de uma alteração automática.”

## Próximas melhorias possíveis

Coletar novos exemplos com consentimento, revisar intenções confundidas, manter um conjunto de teste externo intocado e avaliar representação por caracteres ou embeddings. O modelo atual não substitui uma avaliação maior e não deve ser apresentado como IA de conversa livre.
