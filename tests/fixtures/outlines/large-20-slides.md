# Introduction to Natural Language Processing

## Course Overview

This course covers the fundamentals of NLP, from text preprocessing to modern transformer architectures.

## What is NLP?

- The intersection of linguistics, computer science, and AI
- Teaching machines to understand, generate, and reason about human language
- Applications: search, translation, summarization, chatbots, content moderation

## Historical Timeline

- 1950s: Turing Test and early machine translation
- 1960s: ELIZA and rule-based systems
- 1980s: Statistical methods emerge
- 2000s: Machine learning approaches dominate
- 2017: Attention Is All You Need (Transformers)
- 2020s: Large Language Models reshape the field

## Text Preprocessing

### Tokenization

- Word-level: split on whitespace and punctuation
- Subword: BPE, WordPiece, SentencePiece
- Character-level: individual characters as tokens
- Trade-offs between vocabulary size and sequence length

### Normalization

- Lowercasing
- Stemming vs lemmatization
- Stopword removal (when appropriate)
- Unicode normalization

### Encoding

- One-hot encoding (sparse, no semantics)
- TF-IDF (frequency-based importance)
- Word embeddings (dense, semantic)

## Word Embeddings

- Word2Vec: CBOW and Skip-gram architectures
- GloVe: Global Vectors for Word Representation
- FastText: subword embeddings for morphologically rich languages
- Key insight: words that appear in similar contexts have similar meanings

> "You shall know a word by the company it keeps." — John Rupert Firth (1957)

## Sequence Models

### Recurrent Neural Networks

- Process sequences one token at a time
- Hidden state carries context forward
- Struggle with long-range dependencies
- Vanishing and exploding gradient problems

### LSTMs and GRUs

- Gating mechanisms to control information flow
- Forget gate, input gate, output gate (LSTM)
- Better at capturing long-range dependencies
- Still sequential: cannot parallelize

## The Attention Mechanism

- Allow the model to focus on relevant parts of the input
- Soft attention: weighted average of all positions
- Self-attention: each token attends to every other token
- Multi-head attention: parallel attention patterns

## Transformers

- Introduced in "Attention Is All You Need" (Vaswani et al., 2017)
- Encoder-decoder architecture
- Positional encoding replaces sequential processing
- Fully parallelizable training
- Foundation for modern NLP

## Pre-trained Language Models

### BERT

- Bidirectional Encoder Representations from Transformers
- Masked language modeling pre-training
- Next sentence prediction
- Fine-tune for downstream tasks

### GPT

- Generative Pre-trained Transformer
- Autoregressive: predict next token
- Scaling laws: bigger models, more data, better performance
- GPT-2, GPT-3, GPT-4 progression

### T5

- Text-to-Text Transfer Transformer
- Every NLP task as text generation
- Unified framework for classification, translation, summarization

## Fine-Tuning Strategies

- Full fine-tuning: update all parameters
- Feature extraction: freeze base, train classifier head
- LoRA: Low-Rank Adaptation
- Prompt tuning: learn soft prompts
- Trade-offs: compute, data requirements, catastrophic forgetting

## Named Entity Recognition

- Identify and classify named entities in text
- Categories: person, organization, location, date, etc.
- BIO tagging scheme
- Applications: information extraction, knowledge graphs

## Sentiment Analysis

- Determine subjective opinion in text
- Binary (positive/negative) or fine-grained (1-5 scale)
- Aspect-based: sentiment toward specific features
- Challenges: sarcasm, negation, context dependence

## Machine Translation

- From rule-based to statistical to neural approaches
- Encoder-decoder with attention
- BLEU score for evaluation
- Zero-shot translation with multilingual models
- Low-resource languages remain challenging

## Text Summarization

- Extractive: select key sentences from the source
- Abstractive: generate new text that captures the meaning
- Evaluation: ROUGE metrics
- Challenges: faithfulness, hallucination, length control

## Question Answering

- Extractive QA: find the answer span in a passage
- Generative QA: generate an answer from context
- Open-domain QA: retrieve relevant passages first
- Multi-hop reasoning: combine information across documents

## Ethical Considerations

- Bias in training data propagates to model outputs
- Fairness across demographic groups
- Privacy: models can memorize training data
- Environmental cost of training large models
- Misinformation generation risks

## Evaluation Metrics

- Accuracy, Precision, Recall, F1 for classification
- BLEU, ROUGE, METEOR for generation
- Perplexity for language modeling
- Human evaluation remains the gold standard
- Benchmark datasets: GLUE, SuperGLUE, SQuAD

## Current Research Frontiers

- Multimodal models (text + image + audio)
- Reasoning and chain-of-thought prompting
- Efficient architectures (Mamba, RWKV)
- Retrieval-augmented generation
- Constitutional AI and alignment

## Final Project Guidelines

Note: The final project requires students to implement an NLP pipeline for a task of their choice. Teams of 2-3 are encouraged. Proposals due Week 8, final presentations Week 15.

## Resources and References

- Jurafsky & Martin, "Speech and Language Processing" (3rd ed.)
- Eisenstein, "Introduction to Natural Language Processing"
- Hugging Face documentation and model hub
- Papers With Code NLP leaderboards
- Course materials: github.com/example/nlp-course
