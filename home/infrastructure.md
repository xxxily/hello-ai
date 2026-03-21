# ☁️ 基础设施与部署

> Hardware integration, cloud infra, and model serving.

## Model Serving

### [litellm](https://github.com/BerriAI/litellm)

统一的LLM API网关和SDK，支持100+大模型API的标准化调用，提供成本追踪、负载均衡、日志记录等企业级功能。

- **Stars:** ⭐️ 39.8k
- **Tags:** `AI Gateway` `LLM Proxy` `OpenAI Compatible`
- **最后活动时间:** 2026-03-21

### [onnx](https://github.com/onnx/onnx)

机器学习互操作的开放标准，支持PyTorch、TensorFlow等框架间的模型转换与部署，是AI生态的核心基础设施。

- **Stars:** ⭐️ 20.5k
- **Tags:** `Interoperability` `Deep Learning` `Model Format` `Standard`
- **最后活动时间:** 2026-03-18

### [argo-workflows](https://github.com/argoproj/argo-workflows)

Kubernetes原生的工作流引擎，广泛用于机器学习流水线和MLOps场景，支持DAG编排和GitOps。

- **Stars:** ⭐️ 16.5k
- **Tags:** `MLOps` `Kubernetes` `Workflow`
- **最后活动时间:** 2026-03-20

### [octelium](https://github.com/octelium/octelium)

下一代开源零信任安全访问平台，支持作为远程访问VPN、ZTNA平台、API/AI/MCP网关、PaaS等多种用途。

- **Stars:** ⭐️ 3.5k
- **Tags:** `AI Gateway` `MCP Gateway` `Zero Trust` `VPN` `Kubernetes`
- **最后活动时间:** 2026-03-19

### [supergateway](https://github.com/supercorp-ai/supergateway)

MCP服务器协议转换工具，支持stdio与SSE之间的双向转换，适用于AI网关场景。

- **Stars:** ⭐️ 2.5k
- **Tags:** `MCP` `AI Gateway` `SSE` `Protocol`
- **最后活动时间:** 2025-10-09

### [ai-gateway](https://github.com/envoyproxy/ai-gateway)

基于Envoy Gateway构建的AI网关，统一管理对生成式AI服务的访问，支持多LLM提供商接入。

- **Stars:** ⭐️ 1.4k
- **Tags:** `AI Gateway` `Envoy` `LLM` `Kubernetes`
- **最后活动时间:** 2026-03-20

### [openai-forward](https://github.com/KenyonY/openai-forward)

高效的大语言模型API转发服务，支持OpenAI接口的反向代理，具备速率限制和负载均衡能力。

- **Stars:** ⭐️ 989
- **Tags:** `Reverse Proxy` `LLM Gateway` `Rate Limiting`
- **最后活动时间:** 2025-03-15

### [bedrock-access-gateway](https://github.com/aws-samples/bedrock-access-gateway)

为Amazon Bedrock提供OpenAI兼容的RESTful API接口，便于开发者无缝迁移和集成。

- **Stars:** ⭐️ 953
- **Tags:** `AWS Bedrock` `OpenAI Compatible` `API Gateway`
- **最后活动时间:** 2026-03-13

### [NyaProxy](https://github.com/Nya-Foundation/NyaProxy)

智能API管理中心，支持OpenAI、Gemini、Anthropic等多种AI服务的统一管理、负载均衡和速率限制。

- **Stars:** ⭐️ 952
- **Tags:** `API Management` `Load Balancer` `Multi-Provider`
- **最后活动时间:** 2025-07-07

### [gateway-api-inference-extension](https://github.com/kubernetes-sigs/gateway-api-inference-extension)

Kubernetes Gateway API的推理扩展，为AI模型推理提供标准化的流量管理和路由能力。

- **Stars:** ⭐️ 616
- **Tags:** `Kubernetes` `Inference` `API Gateway`
- **最后活动时间:** 2026-03-20

### [ollama_proxy_server](https://github.com/ParisNeo/ollama_proxy_server)

Ollama多实例代理服务器，提供API密钥安全、负载均衡和用户管理功能。

- **Stars:** ⭐️ 606
- **Tags:** `Ollama` `Proxy` `Load Balancer` `Security`
- **最后活动时间:** 2026-03-20

## 未分类 (Others)

### [ollama](https://github.com/ollama/ollama)

本地运行大语言模型的轻量级工具，支持 Llama、Qwen、DeepSeek、Gemma 等多种开源模型，一键部署即开即用。

- **Stars:** ⭐️ 165.7k
- **Tags:** `LLM` `本地部署` `模型推理`
- **最后活动时间:** 2026-03-20

### [netdata](https://github.com/netdata/netdata)

开源的实时监控与可观测性平台，集成AI驱动的异常检测和智能告警功能。支持容器、Kubernetes和各类数据库的一键部署监控。

- **Stars:** ⭐️ 78.2k
- **Tags:** `监控` `可观测性` `DevOps`
- **最后活动时间:** 2026-03-20

### [vllm](https://github.com/vllm-project/vllm)

vLLM是一个高吞吐量且内存高效的LLM推理和服务引擎，采用PagedAttention技术显著优化显存利用率。广泛应用于生产环境的大模型部署，支持多种主流模型架构和硬件平台。

- **Stars:** ⭐️ 73.8k
- **Tags:** `LLM` `Inference` `Serving` `CUDA` `PyTorch`
- **最后活动时间:** 2026-03-20

### [airflow](https://github.com/apache/airflow)

Apache Airflow是一个强大的工作流编排平台，支持以代码方式定义、调度和监控数据管道与ML工作流，是MLOps领域的核心基础设施工具。

- **Stars:** ⭐️ 44.7k
- **Tags:** `MLOps` `工作流编排` `数据管道` `调度器`
- **最后活动时间:** 2026-03-20

### [LocalAI](https://github.com/mudler/LocalAI)

免费开源的 OpenAI API 替代方案，支持本地部署、无需 GPU，可在消费级硬件上运行。兼容 OpenAI API，支持文本生成、图像生成、语音克隆等多种 AI 功能。

- **Stars:** ⭐️ 44.1k
- **Tags:** `LLM` `Self-hosted` `OpenAI API` `Local Inference`
- **最后活动时间:** 2026-03-20

### [milvus](https://github.com/milvus-io/milvus)

Milvus是一款高性能云原生向量数据库，专为海量向量相似度检索而设计。支持多种索引类型，广泛应用于RAG、图像搜索、推荐系统等AI场景。

- **Stars:** ⭐️ 43.4k
- **Tags:** `vector-database` `rag` `llm` `vector-search`
- **最后活动时间:** 2026-03-20

### [kong](https://github.com/Kong/kong)

云原生API和AI网关，支持LLM请求路由、MCP协议、OpenAI代理等功能，帮助企业和开发者统一管理与治理AI应用流量。

- **Stars:** ⭐️ 43.0k
- **Tags:** `API Gateway` `AI Gateway` `LLM` `Kubernetes`
- **最后活动时间:** 2026-03-10

### [1Panel](https://github.com/1Panel-dev/1Panel)

现代化的Linux服务器运维管理面板，支持Docker容器管理和一键部署Ollama、OpenClaw等AI应用。提供直观的Web界面，简化VPS服务器管理和应用部署流程。

- **Stars:** ⭐️ 34.5k
- **Tags:** `Docker` `服务器管理` `Ollama` `Linux`
- **最后活动时间:** 2026-03-20

### [nacos](https://github.com/alibaba/nacos)

阿里巴巴开源的动态服务发现与配置管理平台，支持MCP注册、AI Agent注册等AI云原生应用构建能力。

- **Stars:** ⭐️ 32.7k
- **Tags:** `MCP注册` `服务发现` `配置管理` `AI云原生`
- **最后活动时间:** 2026-03-20

### [sglang](https://github.com/sgl-project/sglang)

SGLang是一个高性能的大语言模型和多模态模型服务框架，专注于推理优化和高效部署。

- **Stars:** ⭐️ 24.8k
- **Tags:** `inference` `llm` `cuda` `serving`
- **最后活动时间:** 2026-03-20

### [serve](https://github.com/jina-ai/serve)

云原生AI应用构建框架，支持多模态应用的生产级部署与编排。集成Kubernetes、Docker和可观测性工具，简化MLOps和LLMOps流程。

- **Stars:** ⭐️ 21.9k
- **Tags:** `Kubernetes` `MLOps` `Cloud-Native` `Multimodal` `CNCF`
- **最后活动时间:** 2025-03-24

### [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)

将 Gemini CLI、Claude Code、ChatGPT Codex 等多种 CLI 工具封装为 OpenAI/Gemini/Claude 兼容的 API 服务，方便开发者通过统一接口调用多种 AI 模型。

- **Stars:** ⭐️ 18.7k
- **Tags:** `API代理` `多模型支持` `OpenAI兼容`
- **最后活动时间:** 2026-03-20

### [ml-stable-diffusion](https://github.com/apple/ml-stable-diffusion)

Apple官方推出的Stable Diffusion Core ML实现，专为Apple Silicon芯片优化，支持在Mac和iOS设备上高效运行图像生成模型。

- **Stars:** ⭐️ 17.8k
- **Tags:** `Stable Diffusion` `Core ML` `Apple Silicon` `图像生成`
- **最后活动时间:** 2025-07-03

### [web-llm](https://github.com/mlc-ai/web-llm)

高性能浏览器端大语言模型推理引擎，基于WebGPU实现无需服务器的本地LLM运行。支持在浏览器中直接运行ChatGPT等大模型，实现完全客户端AI推理。

- **Stars:** ⭐️ 17.6k
- **Tags:** `WebGPU` `LLM推理` `浏览器AI`
- **最后活动时间:** 2026-03-13

### [dagster](https://github.com/dagster-io/dagster)

现代化的数据资产编排平台，专为数据工程和机器学习工作流设计。支持数据管道的开发、生产部署与监控，是MLOps领域的核心基础设施工具。

- **Stars:** ⭐️ 15.1k
- **Tags:** `数据编排` `MLOps` `ETL` `数据管道`
- **最后活动时间:** 2026-03-20

### [nano-vllm](https://github.com/GeeeekExplorer/nano-vllm)

轻量级 vLLM 实现，专注于大语言模型的高效推理。适合学习 vLLM 架构和轻量级部署场景。

- **Stars:** ⭐️ 12.3k
- **Tags:** `LLM` `推理引擎` `PyTorch`
- **最后活动时间:** 2025-11-03

### [OpenLLM](https://github.com/bentoml/OpenLLM)

OpenLLM 是一个开源大语言模型运行平台，支持将 DeepSeek、Llama 等主流模型部署为 OpenAI 兼容的 API 端点。提供云端部署、模型推理和服务管理的一站式解决方案。

- **Stars:** ⭐️ 12.2k
- **Tags:** `LLM` `Inference` `Deployment` `OpenAI-Compatible`
- **最后活动时间:** 2026-03-16

### [h2ogpt](https://github.com/h2oai/h2ogpt)

开源的私有化GPT聊天工具，支持本地部署和多种文档格式处理。100%隐私保护，支持oLLaMa、Mixtral等多种LLM后端。

- **Stars:** ⭐️ 12.0k
- **Tags:** `私有化部署` `文档问答` `多模态`
- **最后活动时间:** 2025-10-09

### [kubeshark](https://github.com/kubeshark/kubeshark)

Kubernetes 集群网络可观测性工具，利用 eBPF 技术捕获 L4/L7 流量并解密 TLS，支持 MCP 协议供 AI 代理调用。

- **Stars:** ⭐️ 11.8k
- **Tags:** `Kubernetes` `Network Observability` `eBPF` `MCP`
- **最后活动时间:** 2026-03-20

### [tensorzero](https://github.com/tensorzero/tensorzero)

TensorZero是一个开源的工业级LLM应用技术栈，集成了LLM网关、可观测性、优化、评估和实验功能。为构建生产级AI应用提供完整的基础设施解决方案。

- **Stars:** ⭐️ 11.1k
- **Tags:** `LLMOps` `LLM Gateway` `Observability`
- **最后活动时间:** 2026-03-20

### [gateway](https://github.com/Portkey-AI/gateway)

高性能AI网关，统一接入200+大语言模型和50+AI防护栏，提供单一API接口实现智能路由与安全管控。

- **Stars:** ⭐️ 11.0k
- **Tags:** `ai-gateway` `llm` `mcp` `guardrails`
- **最后活动时间:** 2026-03-14

### [text-generation-inference](https://github.com/huggingface/text-generation-inference)

HuggingFace推出的大语言模型推理服务框架，支持BLOOM、Falcon、StarCoder等多种主流模型的高效部署与推理。提供生产级别的文本生成API服务，支持张量并行、流式输出等高级特性。

- **Stars:** ⭐️ 10.8k
- **Tags:** `LLM` `Inference` `Deployment` `PyTorch` `Transformer`
- **最后活动时间:** 2026-01-08

### [meetily](https://github.com/Zackriya-Solutions/meetily)

隐私优先的AI会议助手，支持Parakeet/Whisper实时转录和Ollama本地总结，100%本地处理无需云端。

- **Stars:** ⭐️ 10.5k
- **Tags:** `AI会议助手` `语音转文字` `本地AI` `隐私保护`
- **最后活动时间:** 2026-03-16

### [metaflow](https://github.com/Netflix/metaflow)

Netflix开源的ML基础设施框架，帮助数据科学家构建、管理和部署AI/ML系统。支持分布式训练、LLM工作流和多云部署，提供完整的MLOps解决方案。

- **Stars:** ⭐️ 10.0k
- **Tags:** `mlops` `ml-infrastructure` `distributed-training` `llm` `python`
- **最后活动时间:** 2026-03-19

### [claude-relay-service](https://github.com/Wei-Shaw/claude-relay-service)

一站式AI API中转服务，支持Claude、OpenAI、Gemini等多平台统一接入与订阅共享，降低使用成本。

- **Stars:** ⭐️ 9.9k
- **Tags:** `API中转` `多模型接入` `Claude`
- **最后活动时间:** 2026-03-20

### [skypilot](https://github.com/skypilot-org/skypilot)

SkyPilot是一个统一的AI基础设施管理平台，支持在Kubernetes、Slurm、20+云平台和本地环境上运行、管理和扩展AI工作负载。提供跨云GPU/TPU资源调度、成本优化和分布式训练/推理能力。

- **Stars:** ⭐️ 9.6k
- **Tags:** `GPU管理` `云基础设施` `分布式训练` `LLM部署`
- **最后活动时间:** 2026-03-20

### [gorse](https://github.com/gorse-io/gorse)

开源AI推荐系统引擎，支持经典/LLM排序器和多模态内容嵌入。高性能、易扩展的推荐解决方案。

- **Stars:** ⭐️ 9.6k
- **Tags:** `recommender-system` `machine-learning` `LLM`
- **最后活动时间:** 2026-03-20

### [databend](https://github.com/databendlabs/databend)

云原生数据仓库，支持分析、搜索、AI和Python沙盒。统一架构运行于S3之上，内置向量搜索能力，为AI Agent提供数据基础设施。

- **Stars:** ⭐️ 9.2k
- **Tags:** `Vector Database` `Data Warehouse` `OLAP` `Rust`
- **最后活动时间:** 2026-03-20

### [inference](https://github.com/xorbitsai/inference)

一行代码即可将GPT替换为任意大语言模型。支持在云端、本地或笔记本上运行开源、语音和多模态模型，提供统一的生产级推理API。

- **Stars:** ⭐️ 9.1k
- **Tags:** `LLM推理` `模型部署` `OpenAI兼容` `多模态`
- **最后活动时间:** 2026-03-19

### [OpenMetadata](https://github.com/open-metadata/OpenMetadata)

统一元数据管理平台，支持数据发现、可观测性和治理，提供列级血缘追踪和团队协作功能。内置MCP服务器支持，可与AI助手无缝集成。

- **Stars:** ⭐️ 9.0k
- **Tags:** `metadata-management` `data-governance` `mcp-server` `data-discovery`
- **最后活动时间:** 2026-03-20

### [BentoML](https://github.com/bentoml/BentoML)

一站式AI模型服务化平台，轻松构建模型推理API、任务队列和LLM应用，支持多模型管道和生产级部署。

- **Stars:** ⭐️ 8.5k
- **Tags:** `model-serving` `mlops` `llm-inference` `python`
- **最后活动时间:** 2026-03-16

### [gpt-neox](https://github.com/EleutherAI/gpt-neox)

基于Megatron和DeepSpeed的大规模分布式训练框架，支持模型并行自回归Transformer训练。可用于训练GPT类大语言模型，支持多GPU并行计算。

- **Stars:** ⭐️ 7.4k
- **Tags:** `GPT` `分布式训练` `DeepSpeed` `大语言模型`
- **最后活动时间:** 2026-02-03

### [flyte](https://github.com/flyteorg/flyte)

Flyte是一个动态、弹性的AI工作流编排平台，用于协调数据、模型和计算资源。支持Kubernetes原生部署，适用于机器学习和LLM工作流的生产级管理。

- **Stars:** ⭐️ 6.9k
- **Tags:** `orchestration` `mlops` `kubernetes` `workflow`
- **最后活动时间:** 2026-03-20

### [feast](https://github.com/feast-dev/feast)

开源的 AI/ML 特征存储平台，用于管理、发现和提供机器学习特征。支持实时和批处理特征服务，是 MLOps 基础设施的核心组件。

- **Stars:** ⭐️ 6.8k
- **Tags:** `feature-store` `mlops` `machine-learning` `data-engineering`
- **最后活动时间:** 2026-03-20

### [flower](https://github.com/flwrlabs/flower)

Flower是一个友好的联邦学习框架，支持跨设备进行分布式AI模型训练。兼容PyTorch、TensorFlow等多种深度学习框架，适用于移动端和边缘设备。

- **Stars:** ⭐️ 6.7k
- **Tags:** `federated-learning` `machine-learning` `framework` `privacy`
- **最后活动时间:** 2026-03-20

### [serving](https://github.com/tensorflow/serving)

TensorFlow官方推出的高性能机器学习模型服务系统，专为生产环境设计。支持模型版本管理、多模型并行部署，可无缝集成TensorFlow生态。

- **Stars:** ⭐️ 6.3k
- **Tags:** `TensorFlow` `模型部署` `机器学习` `生产环境`
- **最后活动时间:** 2025-12-18

### [Liger-Kernel](https://github.com/linkedin/Liger-Kernel)

由LinkedIn开源的高效Triton内核库，专为LLM训练优化设计。支持Llama、Mistral、Gemma等主流大模型，显著提升训练效率。

- **Stars:** ⭐️ 6.2k
- **Tags:** `triton` `llm-training` `kernels` `optimization`
- **最后活动时间:** 2026-03-20

### [gpt-load](https://github.com/tbphp/gpt-load)

支持多渠道的 AI 代理服务，具备智能密钥轮询功能，轻松管理 OpenAI、Claude、Gemini 等多个 AI 提供商的 API 调用。

- **Stars:** ⭐️ 6.0k
- **Tags:** `AI代理` `密钥管理` `多渠道` `Go`
- **最后活动时间:** 2026-03-18

### [plano](https://github.com/katanemo/plano)

Plano 是一个面向智能体应用的 AI 原生代理和数据平面，内置编排、安全、可观测性和智能 LLM 路由功能，让开发者专注于智能体的核心逻辑。

- **Stars:** ⭐️ 6.0k
- **Tags:** `ai-gateway` `llm-routing` `proxy` `llmops`
- **最后活动时间:** 2026-03-20

### [zenml](https://github.com/zenml-io/zenml)

开源MLOps平台，用于构建可生产的机器学习管道和AI代理工作流。支持从实验到生产的全生命周期管理，兼容主流ML框架。

- **Stars:** ⭐️ 5.3k
- **Tags:** `MLOps` `Pipeline` `LLMOps` `Agents`
- **最后活动时间:** 2026-03-20

### [superduper](https://github.com/superduper-io/superduper)

端到端的AI应用开发框架，支持构建自定义AI应用和智能体。集成LLM推理、RAG检索、向量搜索等核心能力，简化AI应用全流程开发与部署。

- **Stars:** ⭐️ 5.3k
- **Tags:** `LLM` `RAG` `Agents` `Vector Search`
- **最后活动时间:** 2025-09-01

### [kserve](https://github.com/kserve/kserve)

KServe是CNCF旗下的标准化AI模型推理平台，支持在Kubernetes上部署生成式和预测式AI模型。支持多框架（PyTorch、TensorFlow、XGBoost）和LLM推理，提供可扩展的企业级模型服务解决方案。

- **Stars:** ⭐️ 5.2k
- **Tags:** `Kubernetes` `Model-Serving` `LLM-Inference` `MLOps`
- **最后活动时间:** 2026-03-20

### [cube-studio](https://github.com/tencentmusic/cube-studio)

开源云原生一站式机器学习/深度学习AI平台，支持MLOps全流程、大模型微调训练、多机推理部署、VGPU虚拟化及国产算力生态。

- **Stars:** ⭐️ 4.9k
- **Tags:** `MLOps` `Kubernetes` `大模型训练` `分布式推理`
- **最后活动时间:** 2026-02-06

### [cactus](https://github.com/cactus-compute/cactus)

低延迟AI推理引擎，专为移动设备和可穿戴设备设计。支持LLM推理、语音识别和RAG等多种AI能力，实现高效的端侧智能部署。

- **Stars:** ⭐️ 4.5k
- **Tags:** `mobile-ai` `edge-inference` `llm` `on-device`
- **最后活动时间:** 2026-03-20

### [CTranslate2](https://github.com/OpenNMT/CTranslate2)

高效的 Transformer 模型推理引擎，支持量化优化和多平台加速（CPU/GPU）。专为生产环境设计，可显著提升推理性能并降低内存占用。

- **Stars:** ⭐️ 4.4k
- **Tags:** `inference` `transformer` `quantization` `optimization`
- **最后活动时间:** 2026-02-04

### [pipelines](https://github.com/kubeflow/pipelines)

Kubeflow Pipelines 是 Kubernetes 原生的机器学习工作流编排平台，支持构建、部署和管理可复用的 ML 流水线。提供可视化界面和 SDK，大幅简化 MLOps 实践。

- **Stars:** ⭐️ 4.1k
- **Tags:** `kubeflow` `kubernetes` `mlops` `machine-learning` `pipeline`
- **最后活动时间:** 2026-03-20

### [AI-Infra-from-Zero-to-Hero](https://github.com/HuaizhengZhang/AI-Infra-from-Zero-to-Hero)

从零到精通的AI基础设施学习资源库，涵盖ML系统、LLM和GenAI的顶级论文、行业实践与视频教程。收录OSDI、NSDI等顶会资源，包含Llama3、Mistral等模型的系统实现。

- **Stars:** ⭐️ 3.8k
- **Tags:** `AI基础设施` `ML系统` `LLM` `模型训练` `模型服务`
- **最后活动时间:** 2025-07-25

### [WebGPT](https://github.com/0hq/WebGPT)

使用WebGPU在浏览器中运行GPT模型，仅用不到1500行原生JavaScript实现完整的GPT推理。无需后端服务器，支持直接在网页中运行大语言模型。

- **Stars:** ⭐️ 3.8k
- **Tags:** `GPT` `WebGPU` `浏览器推理` `Transformers`
- **最后活动时间:** 2024-01-12

### [lorax](https://github.com/predibase/lorax)

多LoRA推理服务器，可扩展支持数千个微调后的大语言模型。在单个GPU上高效服务多个LoRA适配器，大幅降低部署成本。

- **Stars:** ⭐️ 3.7k
- **Tags:** `LoRA` `LLM推理` `模型服务`
- **最后活动时间:** 2025-05-21

### [qsv](https://github.com/dathere/qsv)

一款超快的数据处理工具包，支持CSV、Excel、Parquet等多种格式的数据清洗与转换。专为数据工程师设计，大幅提升数据预处理效率。

- **Stars:** ⭐️ 3.5k
- **Tags:** `data-wrangling` `csv` `data-engineering`
- **最后活动时间:** 2026-03-20

### [semantic-router](https://github.com/vllm-project/semantic-router)

系统级智能路由器，支持云端、数据中心和边缘场景的混合模型路由。集成语义分类、PII检测和提示词防护，实现高效的多模型调度与编排。

- **Stars:** ⭐️ 3.5k
- **Tags:** `LLM路由` `混合模型` `AI网关` `Kubernetes`
- **最后活动时间:** 2026-03-20

### [mcp-context-forge](https://github.com/IBM/mcp-context-forge)

IBM开源的AI网关与代理服务，统一管理MCP、A2A及REST/gRPC API接口，提供集中式发现、安全护栏和可观测性能力。

- **Stars:** ⭐️ 3.4k
- **Tags:** `mcp` `api-gateway` `agents` `kubernetes` `fastapi`
- **最后活动时间:** 2026-03-20

### [optimum](https://github.com/huggingface/optimum)

Hugging Face 官方推出的硬件优化工具包，可加速 Transformers、Diffusers 等模型的推理与训练。支持 ONNX、量化及多种硬件后端优化。

- **Stars:** ⭐️ 3.3k
- **Tags:** `optimization` `inference` `transformers` `quantization`
- **最后活动时间:** 2026-03-13

### [AI-Infra-Guard](https://github.com/Tencent/AI-Infra-Guard)

全栈AI红队测试平台，提供Agent扫描、MCP扫描、AI基础设施扫描和LLM越狱评估等全方位安全检测能力。

- **Stars:** ⭐️ 3.3k
- **Tags:** `AI安全` `红队测试` `漏洞扫描`
- **最后活动时间:** 2026-03-20

### [bifrost](https://github.com/maximhq/bifrost)

最快的企业级AI网关，比LiteLLM快50倍，支持1000+模型、自适应负载均衡、集群模式和护栏功能。在5k RPS下延迟仅<100µs，提供完整的LLM可观测性和成本管理。

- **Stars:** ⭐️ 3.1k
- **Tags:** `ai-gateway` `llm` `load-balancing` `guardrails` `mcp`
- **最后活动时间:** 2026-03-20

### [llm-compressor](https://github.com/vllm-project/llm-compressor)

与Transformers兼容的LLM压缩库，支持量化、稀疏化等多种压缩算法，专为vLLM优化部署而设计。帮助开发者显著降低模型推理成本和内存占用。

- **Stars:** ⭐️ 2.9k
- **Tags:** `compression` `quantization` `vLLM`
- **最后活动时间:** 2026-03-20

### [distributed-llama](https://github.com/b4rtaz/distributed-llama)

分布式LLM推理框架，可将多台家用设备连接成集群加速大模型推理，设备越多推理越快。

- **Stars:** ⭐️ 2.9k
- **Tags:** `distributed-inference` `llm` `cluster`
- **最后活动时间:** 2026-02-10

### [lingvo](https://github.com/tensorflow/lingvo)

Google开源的序列建模框架，专注于语音识别、机器翻译和NLP任务，支持大规模分布式训练和GPU加速。

- **Stars:** ⭐️ 2.9k
- **Tags:** `TensorFlow` `Speech Recognition` `Machine Translation` `NLP`
- **最后活动时间:** 2026-03-17

### [spiceai](https://github.com/spiceai/spiceai)

一个用 Rust 编写的便携式加速 SQL 查询、搜索和 LLM 推理引擎，专为数据驱动的 AI 应用和智能体设计。支持数据联邦、全文搜索和 LLM 推理，为构建数据落地型 AI 应用提供强大的基础设施支持。

- **Stars:** ⭐️ 2.8k
- **Tags:** `SQL` `LLM推理` `数据联邦` `Rust` `搜索引擎`
- **最后活动时间:** 2026-03-20

### [xDiT](https://github.com/xdit-project/xDiT)

一个可扩展的Diffusion Transformers推理引擎，支持大规模并行计算，显著提升DiT模型推理性能。

- **Stars:** ⭐️ 2.6k
- **Tags:** `Diffusion Transformers` `Inference Engine` `Parallelism`
- **最后活动时间:** 2026-03-18

### [axonhub](https://github.com/looplj/axonhub)

开源AI网关，支持通过任意SDK调用100+大语言模型，内置故障转移、负载均衡、成本控制和端到端追踪功能。

- **Stars:** ⭐️ 2.5k
- **Tags:** `AI Gateway` `LLM` `API Gateway` `Load Balancing`
- **最后活动时间:** 2026-03-20

### [harbor](https://github.com/av/harbor)

一条命令即可部署完整的LLM技术栈，集成数百个AI服务。支持Docker容器化部署，适合本地自托管和Homelab场景。

- **Stars:** ⭐️ 2.5k
- **Tags:** `Docker` `LLM` `Self-hosted` `MCP`
- **最后活动时间:** 2026-03-20

### [bionic-gpt](https://github.com/bionic-gpt/bionic-gpt)

企业级本地化ChatGPT替代方案，在保证数据隐私和机密性的前提下提供生成式AI能力。基于Rust构建的全栈解决方案，支持本地部署。

- **Stars:** ⭐️ 2.3k
- **Tags:** `on-premise` `LLMOps` `Rust`
- **最后活动时间:** 2026-03-20

### [instill-core](https://github.com/instill-ai/instill-core)

全栈AI基础设施工具，提供数据、模型和流水线编排能力，帮助开发者快速构建AI应用。支持低代码/无代码方式，集成LLM、Stable Diffusion等多种AI能力。

- **Stars:** ⭐️ 2.3k
- **Tags:** `AI基础设施` `流水线编排` `低代码` `LLM` `开源`
- **最后活动时间:** 2026-03-19

### [hls4ml](https://github.com/fastmachinelearning/hls4ml)

将机器学习模型部署到FPGA的开源库，利用高级综合技术实现神经网络硬件加速。支持Keras、PyTorch和ONNX模型转换，适用于低延迟推理场景。

- **Stars:** ⭐️ 1.9k
- **Tags:** `FPGA` `HLS` `硬件加速` `神经网络部署`
- **最后活动时间:** 2026-03-20

### [vllm-ascend](https://github.com/vllm-project/vllm-ascend)

vLLM在华为昇腾NPU上的硬件适配插件，支持在Ascend硬件上高效运行大模型推理服务。为使用昇腾芯片的用户提供无缝的vLLM部署体验。

- **Stars:** ⭐️ 1.8k
- **Tags:** `vLLM` `Ascend` `LLM推理` `硬件加速`
- **最后活动时间:** 2026-03-20

### [nndeploy](https://github.com/nndeploy/nndeploy)

一款简单易用且高性能的AI部署框架，支持TensorRT、ONNXRuntime、OpenVINO、MNN等多种推理后端。提供低代码工作流编排能力，覆盖LLM、GenAI、Diffusers等多种AI应用场景。

- **Stars:** ⭐️ 1.8k
- **Tags:** `部署框架` `TensorRT` `多后端` `LLM`
- **最后活动时间:** 2026-03-15

### [toolhive](https://github.com/stacklok/toolhive)

ToolHive是企业级MCP服务器运行管理平台，专注于AI安全与基础设施部署。支持Kubernetes环境，为Model Context Protocol提供安全可靠的服务器管理解决方案。

- **Stars:** ⭐️ 1.7k
- **Tags:** `MCP` `AI Security` `Kubernetes`
- **最后活动时间:** 2026-03-20

### [mlrun](https://github.com/mlrun/mlrun)

开源MLOps平台，用于快速构建和管理ML应用的全生命周期。支持自动化ML流水线、模型服务和CI/CD集成。

- **Stars:** ⭐️ 1.7k
- **Tags:** `MLOps` `Kubernetes` `Model-Serving`
- **最后活动时间:** 2026-03-20

### [langchain-serve](https://github.com/jina-ai/langchain-serve)

基于Jina和FastAPI将LangChain应用快速部署到生产环境的工具。支持AutoGPT、BabyAGI等自主代理和聊天机器人的云端部署。

- **Stars:** ⭐️ 1.6k
- **Tags:** `langchain` `fastapi` `deployment` `production` `llm`
- **最后活动时间:** 2023-09-20

### [APIPark](https://github.com/APIParkLab/APIPark)

云原生超高性能AI网关平台，统一管理OpenAI、Claude、DeepSeek等主流大模型API，提供负载均衡、多模型灾备、调用统计和API审批等功能。

- **Stars:** ⭐️ 1.6k
- **Tags:** `AI Gateway` `LLM Gateway` `API Management`
- **最后活动时间:** 2025-10-26

### [beta9](https://github.com/beam-cloud/beta9)

超快速的无服务器GPU推理平台，支持沙箱环境和后台任务处理。专为AI/ML工作负载设计，提供自动扩缩容和分布式计算能力。

- **Stars:** ⭐️ 1.6k
- **Tags:** `serverless` `gpu` `llm-inference` `ml-platform`
- **最后活动时间:** 2026-03-20

### [pixeltable](https://github.com/pixeltable/pixeltable)

Pixeltable 是面向多模态 AI 工作负载的数据基础设施，采用声明式、增量式方法简化数据处理流程。集成了特征存储、向量数据库和 MLOps 能力，大幅降低 AI 应用开发复杂度。

- **Stars:** ⭐️ 1.6k
- **Tags:** `多模态` `数据基础设施` `特征存储` `向量数据库`
- **最后活动时间:** 2026-03-20

### [boxlite](https://github.com/boxlite-ai/boxlite)

为AI智能体提供安全沙箱环境，支持嵌入式部署、状态持久化、快照和硬件隔离，确保智能体执行的安全性与可控性。

- **Stars:** ⭐️ 1.6k
- **Tags:** `sandbox` `ai-agents` `security` `containers`
- **最后活动时间:** 2026-03-20

### [Bytez](https://github.com/Bytez-com/docs)

Bytez 是全球最大的无服务器模型推理 API 平台，提供 220,000+ AI 模型的统一访问接口。开发者只需一个 API 密钥即可调用 Llama3、Mistral、DeepSeek 等主流大模型。

- **Stars:** ⭐️ 1.6k
- **Tags:** `api` `serverless` `llms` `inference`
- **最后活动时间:** 2026-03-03

### [robustmq](https://github.com/robustmq/robustmq)

下一代统一通信基础设施，支持 AI、IoT 和大数据场景。基于 Rust 构建，提供 MQTT、AMQP、Kafka 多协议支持的高性能消息队列。

- **Stars:** ⭐️ 1.5k
- **Tags:** `消息队列` `中间件` `Rust` `MQTT`
- **最后活动时间:** 2026-03-19

### [mlreef](https://github.com/MLReef/mlreef)

一个面向机器学习的协作工作平台，支持模型开发、版本控制和实验追踪，助力团队高效进行MLOps实践。

- **Stars:** ⭐️ 1.5k
- **Tags:** `MLOps` `协作平台` `机器学习` `深度学习`
- **最后活动时间:** 2022-11-01

### [motorhead](https://github.com/getmetal/motorhead)

Motorhead 是一个用 Rust 编写的记忆服务器，旨在自动管理 LLM 的聊天记录摘要和持久化。它解决了 LLM 无状态的问题，简化了构建智能体和对话应用的流程。

- **Stars:** ⭐️ 1.4k
- **Tags:** `Memory` `Rust` `LLMOps`
- **最后活动时间:** 2024-03-01

### [stable-fast](https://github.com/chengzeyi/stable-fast)

针对HuggingFace Diffusers的高性能推理优化框架，在NVIDIA GPU上实现最佳推理性能。支持Stable Diffusion、Stable Video Diffusion等多种扩散模型。

- **Stars:** ⭐️ 1.3k
- **Tags:** `inference-optimization` `stable-diffusion` `cuda` `pytorch`
- **最后活动时间:** 2025-03-27

### [MLOpsPython](https://github.com/microsoft/MLOpsPython)

微软官方的MLOps实践项目，演示如何使用Azure ML Services和Azure DevOps构建完整的机器学习运维流水线。涵盖模型训练、部署、监控等全生命周期管理。

- **Stars:** ⭐️ 1.3k
- **Tags:** `MLOps` `Azure ML` `DevOps` `机器学习运维`
- **最后活动时间:** 2023-08-05

### [agentic_coding_flywheel_setup](https://github.com/Dicklesworthstone/agentic_coding_flywheel_setup)

在30分钟内将Ubuntu VPS配置为完整的多智能体AI开发环境，包含编码智能体、会话管理、安全工具和协调基础设施。

- **Stars:** ⭐️ 1.3k
- **Tags:** `multi-agent` `dev-environment` `automation`
- **最后活动时间:** 2026-03-20

### [uni-api](https://github.com/yym68686/uni-api)

统一管理多个LLM API提供商的网关服务，支持OpenAI、Claude、Gemini等后端，提供统一接口和负载均衡。

- **Stars:** ⭐️ 1.2k
- **Tags:** `API网关` `负载均衡` `OpenAI兼容`
- **最后活动时间:** 2026-03-13

### [BricksLLM](https://github.com/bricks-cloud/BricksLLM)

企业级 LLM API 网关，提供成本控制、速率限制和细粒度访问控制，支持 OpenAI、Anthropic、vLLM 等主流模型提供商。

- **Stars:** ⭐️ 1.2k
- **Tags:** `API Gateway` `Rate Limiting` `Cost Control` `Self-hosted`
- **最后活动时间:** 2025-01-05

### [modal-examples](https://github.com/modal-labs/modal-examples)

Modal官方示例代码库，展示如何使用无服务器GPU云平台构建和部署AI/ML应用。涵盖PyTorch、Stable Diffusion等热门框架的实际应用案例。

- **Stars:** ⭐️ 1.1k
- **Tags:** `serverless` `GPU` `PyTorch` `Stable Diffusion`
- **最后活动时间:** 2026-03-17

### [xllm](https://github.com/jd-opensource/xllm)

高性能LLM推理引擎，针对多种AI加速器优化，支持DeepSeek、GLM、Qwen等主流大模型的高效部署。

- **Stars:** ⭐️ 1.1k
- **Tags:** `inference` `llm` `accelerator`
- **最后活动时间:** 2026-03-20

### [rtp-llm](https://github.com/alibaba/rtp-llm)

阿里巴巴开源的高性能大语言模型推理引擎，专为多样化应用场景优化。支持高效部署和服务化LLM模型，提供卓越的推理性能。

- **Stars:** ⭐️ 1.1k
- **Tags:** `LLM` `Inference` `Serving`
- **最后活动时间:** 2026-03-20

### [FastFlowLM](https://github.com/FastFlowLM/FastFlowLM)

专为AMD Ryzen™ AI NPU优化的本地LLM运行工具，类似Ollama但深度适配AMD硬件。可在数分钟内快速部署并运行大语言模型，充分发挥NPU加速能力。

- **Stars:** ⭐️ 1.0k
- **Tags:** `AMD` `NPU` `LLM` `本地部署`
- **最后活动时间:** 2026-03-20

### [llmgateway](https://github.com/theopenco/llmgateway)

统一管理多个LLM提供商的API请求，提供智能路由、速率限制、成本分析和安全防护功能。支持OpenAI、Anthropic等主流服务商，适合企业级AI应用部署。

- **Stars:** ⭐️ 998
- **Tags:** `LLM Gateway` `API Management` `Multi-Provider` `TypeScript`
- **最后活动时间:** 2026-03-20

### [auto-round](https://github.com/intel/auto-round)

Intel开源的高精度LLM量化工具包，支持MXFP4、NVFP4、GGUF等多种量化格式，以精度优先为设计理念，最大限度减少量化带来的质量损失。

- **Stars:** ⭐️ 915
- **Tags:** `quantization` `llms` `gguf` `transformers`
- **最后活动时间:** 2026-03-20

### [kvcached](https://github.com/ovg-project/kvcached)

虚拟化弹性KV缓存系统，支持动态GPU共享与多租户LLM推理服务。兼容vLLM、SGLang等主流推理框架，显著提升GPU资源利用率。

- **Stars:** ⭐️ 814
- **Tags:** `KV Cache` `GPU Sharing` `LLM Inference` `vLLM`
- **最后活动时间:** 2026-03-17

### [deepcompressor](https://github.com/nunchaku-ai/deepcompressor)

专为大型语言模型和扩散模型设计的模型压缩工具箱，支持量化、剪枝等压缩技术，有效降低模型部署成本与资源消耗。

- **Stars:** ⭐️ 762
- **Tags:** `Model Compression` `LLM` `Diffusion Models` `Quantization`
- **最后活动时间:** 2025-08-14

### [headroom](https://github.com/chopratejas/headroom)

LLM应用的上下文优化层，通过智能压缩和token优化技术解决上下文窗口限制问题，支持OpenAI、Anthropic等多种LLM提供商。

- **Stars:** ⭐️ 751
- **Tags:** `context-optimization` `llm` `proxy` `token-compression` `rag`
- **最后活动时间:** 2026-03-20

### [deep-eye](https://github.com/zakirkun/deep-eye)

一款AI驱动的漏洞扫描与渗透测试工具，集成OpenAI、Grok、OLLAMA、Claude等多种AI模型，支持自动化漏洞挖掘、智能载荷生成和专业报告输出。

- **Stars:** ⭐️ 664
- **Tags:** `安全测试` `渗透测试` `AI驱动`
- **最后活动时间:** 2026-02-03

### [reverse-engineering-assistant](https://github.com/cyberkaida/reverse-engineering-assistant)

基于MCP协议的逆向工程助手，支持Ghidra和Binary Ninja等工具。让LLM辅助分析二进制文件，提升安全研究效率。

- **Stars:** ⭐️ 647
- **Tags:** `MCP` `Ghidra` `逆向工程` `LLM`
- **最后活动时间:** 2026-03-16

### [vllm-mlx](https://github.com/waybarrios/vllm-mlx)

专为 Apple Silicon 优化的 OpenAI/Anthropic 兼容推理服务器，支持 LLM 和视觉语言模型的连续批处理推理。原生 MLX 后端实现高达 400+ tok/s 性能，支持 MCP 工具调用和多模态能力。

- **Stars:** ⭐️ 630
- **Tags:** `Apple Silicon` `MLX` `推理服务` `多模态`
- **最后活动时间:** 2026-03-20

### [ollama-helm](https://github.com/otwld/ollama-helm)

用于在 Kubernetes 集群中部署 Ollama 的 Helm Chart，简化大语言模型的容器化部署流程。支持 GPU 资源配置和模型管理，适合生产环境使用。

- **Stars:** ⭐️ 561
- **Tags:** `Helm` `Kubernetes` `Ollama` `LLM部署`
- **最后活动时间:** 2026-03-20

### [ClawPanel](https://github.com/zhaoxinyi02/ClawPanel)

OpenClaw AI 助手可视化管理面板，支持 20+ 通道统一管理，Go 单二进制部署，跨平台实时日志监控。

- **Stars:** ⭐️ 554
- **Tags:** `AI助手` `管理面板` `多通道` `Docker`
- **最后活动时间:** 2026-03-20

### [AngelSlim](https://github.com/Tencent/AngelSlim)

腾讯开源的模型压缩工具包，专注于提升可用性、全面性和效率。支持LLM/VLM量化、FP4压缩、推测解码等多种压缩技术，覆盖DeepSeek、Qwen、Hunyuan等主流模型。

- **Stars:** ⭐️ 549
- **Tags:** `quantization` `llm-compression` `speculative-decoding`
- **最后活动时间:** 2026-03-20

### [pinme](https://github.com/glitternetwork/pinme)

一键部署前端应用的工具，支持 Claude Code Skills 集成，零配置即可完成静态站点托管和 Serverless 部署。

- **Stars:** ⭐️ N/A
- **Tags:** `deployment` `claude-code` `frontend` `serverless`
- **最后活动时间:** 2025-01-01

### [ComfyUI-MultiGPU](https://github.com/pollockjj/ComfyUI-MultiGPU)

ComfyUI自定义节点，提供一键式

- **Stars:** ⭐️ N/A
- **Tags:** 无

### [ClawRouter](https://github.com/BlockRunAI/ClawRouter)

ClawRouter 是一款面向 AI 智能体原生设计的 LLM 路由器，支持 41+ 模型且路由延迟低于 1ms。集成 USDC 微支付功能，支持 Base 和 Solana 链上的稳定币结算。

- **Stars:** ⭐️ N/A
- **Tags:** `LLM Router` `AI Agents` `Cost Optimization` `Micropayments`
- **最后活动时间:** 2026-03-20

