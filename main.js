(() => {
  const builderState = {
    algorithm: "PPO",
    network: "Separate",
  };
  const escapeHtml = (sourceText) =>
    sourceText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  function highlightCode(source) {
    return source
      .split("\n")
      .map((line) => {
        if (line.trim().startsWith("//") || line.trim().startsWith("# ")) {
          return `<span class="syntax-comment">${escapeHtml(line)}</span>`;
        }
        return escapeHtml(line).replace(
          /\b(let|mut|use|fn|pub|type|Ok)\b|\b([A-Z][A-Za-z0-9_]+)\b|\b(\d[\d_]*(?:\.\d+)?(?:e-\d+)?)\b/g,
          (match, keyword, typeName) =>
            `<span class="syntax-${keyword ? "keyword" : typeName ? "type" : "number"}">${match}</span>`,
        );
      })
      .join("\n");
  }

  function buildEnvironmentSnippet(algorithm, networkTopology) {
    const supportsNetworkTopology = algorithm === "PPO" || algorithm === "A2C";
    const environmentType = algorithm === "TD3" ? "PendulumV1" : "CartPoleV1";
    return `// ${algorithm === "TD3" ? "Pendulum" : "CartPole"} · ${supportsNetworkTopology ? `${networkTopology.toLowerCase()} models · ` : ""}${algorithm}
use burn::tensor::Device;
use modurl::prelude::*;
use modurl_gym::classic_control::${algorithm === "TD3" ? "pendulum" : "cartpole"}::${environmentType};

let device = Device::flex().autodiff();
let env = ${environmentType}::builder().seed(7).build()?;
let env = VectorizedGymWrapper::from(env);
let mut env = DeviceMultiGymWrapper::new(env, Device::flex(), device.clone());
let observation_space = env.observation_space();
let action_space = env.action_space();
`;
  }

  function buildOnPolicySnippet(algorithm, networkTopology) {
    let snippet = "";
    snippet +=
      networkTopology === "Separate"
        ? `// actor_model, critic and optimizers: setup omitted; see the guide.
`
        : `// trunk, actor_head_model, value_head and optimizer: setup omitted.
`;
    snippet += `let ${networkTopology === "Shared" ? "policy_head" : "policy"} = ProbabilisticPolicyModel::new(
    ${networkTopology === "Shared" ? "actor_head_model" : "actor_model"},
    CategoricalDistribution,
);
`;
    snippet +=
      networkTopology === "Separate"
        ? `
let networks = Separate${algorithm}Network::builder()
    .actor_network(policy)
    .critic_network(critic)
    .actor_optimizer(actor_optimizer)
    .critic_optimizer(critic_optimizer)
    .actor_learning_rate(3e-4)
    .critic_learning_rate(3e-4)
    .build()?;
`
        : `
let networks = Shared${algorithm}Network::builder()
    .shared_network(trunk)
    .actor_head(policy_head)
    .critic_head(value_head)
    .optimizer(optimizer)
    .learning_rate(3e-4)
    .build()?;
`;
    const networkInfo =
      algorithm === "A2C"
        ? `A2CNetworkInfo::${networkTopology.toLowerCase()}(networks)`
        : "networks";
    snippet += `
let mut agent = ${algorithm}Agent::builder()
    .observation_space(observation_space)
    .action_space(action_space)
    .network_info(${networkInfo})
    .batch_size(2_048)
`;
    if (algorithm === "PPO") {
      snippet += `    .mini_batch_size(64)
    .clip_range(ConstantSchedule::new(0.2))
`;
    }
    return snippet;
  }

  function buildOffPolicySnippet(algorithm) {
    let snippet = "";
    const omittedSetup = {
      SAC: `// actor_model, actor_optimizer, two discrete Q critics and entropy:
// setup omitted; see the guide.
`,
      DQN: `// online_q_network (MLP Q values per action) and optimizer:
// built as in the guide (setup omitted).
`,
      TD3: `// online_actor (bounded scalar action), actor_optimizer and two
// state-action critics: built as in the guide (setup omitted).
`,
    };
    snippet += omittedSetup[algorithm];
    if (algorithm === "SAC") {
      snippet += `let policy = ProbabilisticPolicyModel::new(
    actor_model,
    CategoricalDistribution,
);
`;
    }
    const agentOptions = {
      SAC: `.policy(policy)
    .actor_optimizer(actor_optimizer)
    .actor_learning_rate(3e-4)
    .critics(critics)
    .entropy_configuration(entropy)`,
      DQN: `.online_q_network(online_q_network)
    .optimizer(optimizer)
    .learning_rate(2.5e-4)
    .epsilon_schedule(|p: f64| 1.0 - 0.95 * p)`,
      TD3: `.online_actor(online_actor)
    .actor_optimizer(actor_optimizer)
    .actor_learning_rate(1e-3)
    .critics(critics)
    .exploration_noise(0.1)`,
    };
    snippet += `
let mut agent = ${algorithm}Agent::builder()
    .observation_space(observation_space)
    .action_space(action_space)
    ${agentOptions[algorithm]}
    .replay_capacity(100_000)
    .batch_size(128)
`;
    return snippet;
  }

  function renderBuilder() {
    const { algorithm, network: networkTopology } = builderState;
    const supportsNetworkTopology = algorithm === "PPO" || algorithm === "A2C";
    document.querySelector("#network-options").hidden =
      !supportsNetworkTopology;
    let snippet = buildEnvironmentSnippet(algorithm, networkTopology);
    snippet += supportsNetworkTopology
      ? buildOnPolicySnippet(algorithm, networkTopology)
      : buildOffPolicySnippet(algorithm);
    snippet += `    .training_horizon(100_000)
    .build()?;

agent.learn(&mut env, 100_000)?;`;
    document.querySelector("#builder-code").innerHTML = highlightCode(snippet);
  }

  function initializeBuilder() {
    document.querySelectorAll("[data-choice]").forEach((group) =>
      group.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button) {
          return;
        }
        builderState[group.dataset.choice] = button.textContent;
        group
          .querySelectorAll("button")
          .forEach((choiceButton) =>
            choiceButton.setAttribute(
              "aria-pressed",
              String(choiceButton === button),
            ),
          );
        renderBuilder();
      }),
    );
    renderBuilder();
  }

  initializeBuilder();

  function initializeQuickStart() {
    const terminalExample = `# Clone the repository
git clone https://github.com/ModuRL/ModuRL.git
cd ModuRL

# Train PPO on eight CartPole environments
cargo run --release -p examples --example ppo_cartpole`;
    const rustExample = `use burn::{optim::AdamWConfig, tensor::Device};
use modurl::prelude::*;
use modurl_gym::classic_control::cartpole::CartPoleV1;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let device = Device::flex().autodiff();
    let env = VectorizedGymWrapper::from(CartPoleV1::builder().build()?);
    let mut env = DeviceMultiGymWrapper::new(env, Device::flex(), device.clone());
    let model = |output_size| {
        MLP::builder()
            .input_size(4)
            .output_size(output_size)
            .options(&device)
            .build()
    };
    let policy = ProbabilisticPolicyModel::new(model(2)?, CategoricalDistribution);
    let networks = SeparatePPONetwork::builder()
        .actor_network(policy)
        .critic_network(model(1)?)
        .actor_optimizer(AdamWConfig::new().init())
        .critic_optimizer(AdamWConfig::new().init())
        .actor_learning_rate(3e-4)
        .critic_learning_rate(3e-4)
        .build()?;
    let mut agent = PPOAgent::builder()
        .observation_space(env.observation_space())
        .action_space(env.action_space())
        .network_info(networks)
        .build()?;
    agent.learn(&mut env, 100_000)?;
    Ok(())
}
`;
    const quickStartPanel = document.querySelector("#quick-code");
    function selectQuickStartTab(rustSelected) {
      document
        .querySelectorAll("[role=tab]")
        .forEach((tabButton) =>
          tabButton.setAttribute(
            "aria-selected",
            String((tabButton.id === "rust-tab") === rustSelected),
          ),
        );
      quickStartPanel.setAttribute(
        "aria-labelledby",
        rustSelected ? "rust-tab" : "terminal-tab",
      );
      quickStartPanel.querySelector("code").innerHTML = highlightCode(
        rustSelected ? rustExample : terminalExample,
      );
    }
    document.querySelectorAll("[role=tab]").forEach((tabButton) => {
      tabButton.addEventListener("click", () =>
        selectQuickStartTab(tabButton.id === "rust-tab"),
      );
      tabButton.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          const otherTab = document.querySelector(
            tabButton.id === "rust-tab" ? "#terminal-tab" : "#rust-tab",
          );
          otherTab.focus();
          otherTab.click();
        }
      });
    });
    selectQuickStartTab(false);
  }

  initializeQuickStart();

  function initializeClipboard() {
    let copyTimer;
    const copyIcon = document.querySelector("#copy-icon");
    document.querySelector("#install").addEventListener("click", async () => {
      clearTimeout(copyTimer);
      copyIcon.classList.remove("copied");
      try {
        await navigator.clipboard.writeText("cargo add modurl");
        copyIcon.classList.add("copied");
        document.querySelector("#copy-status").textContent =
          "Copied cargo add modurl";
      } catch {
        document.querySelector("#copy-status").textContent =
          "Clipboard unavailable. Select and copy: cargo add modurl";
      }
      copyTimer = setTimeout(() => {
        copyIcon.classList.remove("copied");
      }, 1500);
    });
  }

  initializeClipboard();

  function initializeReveals() {
    const revealSurfaces = [
      ...document.querySelectorAll(".reveal,.benchmark-panel"),
    ];
    const revealElement = (element) => {
      element.classList.remove("reveal-pending");
      element.classList.add("visible");
    };
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              revealElement(entry.target);
              observer.unobserve(entry.target);
            }
          }),
        {
          threshold: 0.01,
        },
      );
      revealSurfaces.forEach((element) => {
        const bounds = element.getBoundingClientRect();
        if (bounds.top < innerHeight && bounds.bottom > 0) {
          revealElement(element);
        } else {
          element.classList.add("reveal-pending");
          observer.observe(element);
        }
      });
      const scheduleRevealFailsafe = () =>
        setTimeout(() => {
          revealSurfaces.forEach(revealElement);
          observer.disconnect();
        }, 1800);
      if (document.readyState === "complete") {
        scheduleRevealFailsafe();
      } else {
        window.addEventListener("load", scheduleRevealFailsafe, {
          once: true,
        });
      }
    } else {
      revealSurfaces.forEach(revealElement);
    }
  }

  initializeReveals();
})();
