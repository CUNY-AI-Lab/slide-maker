This workshop ties together creative coding and "vibe coding" with generative AI to guide participants in designing and creating a single-page creative coding artifact in a browser-based environment. You'll leave with a shareable prototype and practical strategies for bringing this approach into your teaching, research, or creative practice. 

* [**https://cuny-ai-lab.github.io/creative-coding/**](https://cuny-ai-lab.github.io/creative-coding/)

# **Slide 1**

## **Creative Coding with Generative AI**

### **Title Slide**

* Zach Muhlbauer & Stefano Morello  
* CUNY AI Lab · New Media Lab · Teaching and Learning Center  
* Interactive Technology and Pedagogy Certificate Program  
* February 19, 2025 · 4:00 PM  
* Artifact: Interactive 10 PRINT demonstration

# **Slide 2**

## **Icebreaker**

### **Describe an algorithm you already know**

* Write a routine in three steps or fewer   
* Rethink “rules executed by hand” as a kind of algorithm  
* **Prompt**: In three steps or less, describe something you do in your everyday life and frame it as a conditional, a loop, or a sequence   
  * If X then Y (conditional): “If it’s raining, grab an umbrella; otherwise, wear sunglasses.”  
  * Repeat until done (loop): Wash the dishes step by step until the sink is empty.  
  * First A then B (sequence): Preheat the oven, mix the batter, pour it into a pan, then bake.

# **Slide 3**

## **Origins (1962-1965)**

### **Bell Labs \+ first computer art**

* Historical roots of computer art during Bell Labs era  
* Mixed equations with pseudo-random variations  
* Generate order first; introduce disorder gradually  
* Moved from plotter demonstrations to public exhibitions  
* Artifact: Plotter Demonstration

# **Slide 4**

## **Vera Molnar**

### **The “machine imaginaire”**

* Art as a set of rules plus “a hint of disorder”  
* Constrain a system; let chance disturb it  
* Treat constraints as principles for art-making   
* Artifact: Machine Imaginaire (Drag the interruption zone to disrupt the grid)

# **Slide 5**

## **Creative Coding Today**

### **Web browser as canvas (Artifact)**

* Frames the browser as a portable art canvas  
* Prefers portable, single-file artifacts   
* Keeps tools lightweight and portable  
* Includes:   
  * HTML for content: The foundation and walls of the house, or the structure that holds everything up  
  * CSS for styling: The paint, furniture, and curtains, or what makes it look and feel like your place  
  * JavaScript for interactivity: The light switches, doors, and plumbing, or the parts that respond when you interact with them

# **Slide 6**

## **Key Concept**

### **The creative coding triangle (Artifact)**

* Rules / Randomness / Interpretation  
  * Rules: constraints and logic you set (loops, grids, conditionals)  
  * Randomness: surprises you invite in (random values, noise, chance)  
  * Interpretation: curatorial choices you make (color, scale, what to keep, what to throw away)

# **Slide 7**

## **Vibe Coding**

### **Prompts as prototypes**

* “Vibe coding” attributed to Andrej Karpathy  
* Prototype with prompts, then test in browser  
* Generate fast; evaluate with your own eyes  
* “No-review” vs reviewed iteration  
* Adopt the mode that matches your goal

# **Slide 8**

## **(Vibe) Coding with Intention**

### **Vibe → deliberate practice**

* Place AI-based coding on a continuum of control  
* One-shot → iterate → constrain  
* Decompose tasks to increase decision points (Xu et al., 2024\)  
* Utilize constraints to foster more deliberate choices 

# **Slide 9**

## **Prompt Anatomy**

### **Structure prompts for creative code**

* Assign a role (e.g. “creative coder”)   
* Constrain the stack: Canvas \+ vanilla JavaScript  
* Set the style: monochrome, geometric, early-computer  
* Require motion \+ interaction: animation loop \+ input  
* Demand a runnable deliverable: single HTML only

Sample prompt:

Role: You are a creative coder.
Constraints: vanilla JS only; Canvas; full viewport; no external libraries.
Aesthetic: monochrome; geometric; early computer art.
Tech: requestAnimationFrame; mouse interaction.
Output: return single HTML only (no markdown/explanation).

# **Slide 10**

## **Live Demo**

### **CUNY AI Lab Sandbox (Open WebUI)**

* Open: [https://chat.ailab.gc.cuny.edu](https://chat.ailab.gc.cuny.edu)  
* Create an account; await pending approval; then sign in  
* Confirm you’re in by posting a 👍 in the chat  
* Choose a model: GLM 5 or Kimi K2.5 (MoE)  
* Open the Configuration panel (right side)  
* Paste the system prompt; set temperature \+ max tokens  
* Optional: model notes: [https://ailab.gc.cuny.edu/models](https://ailab.gc.cuny.edu/models)

Stage text:

* Run the same prompt 3× at low temp, then 3× at high temp; then force truncation with low max tokens.

---

# **Slide 11**

## **Activity 1 (10m)**

### **Constrained Generation**

* Open the Configuration panel (right side)
* Add a system prompt:
  
  Role: You are a creative coding assistant.
  Constraints: Follow constraints exactly as specified.
  Output: Single HTML files with embedded CSS and JavaScript.
  
* Try user prompts with specific limits:
  * "Create a rotating spiral using only triangles"
  * "Build a rain animation with exactly 4 colors"
  * "Make generative art that tiles like wallpaper"

---

# **Slide 12**

## **Activity 2 (15m)**

### **Iterate and Refine**

* Keep your previous result and refine it through conversation
* Try follow-up prompts like:
  * "Add mouse interaction"
  * "Make the movement faster"
  * "Change the color palette to sunset tones"
* Practice the back-and-forth refinement process

---

# **Slide 13**

## **Activity 3 (15m)**

### **Parameter Exploration**

* Experiment with max tokens (response length) and temperature (randomness, 0.0-2.0)
* Try the same prompt with different settings:
  * Temperature 0.1 (predictable) vs 1.8 (creative)
  * Max tokens 1024 (concise) vs 4096 (detailed)
* How do these parameters change the AI's creative output?

---

# **Slide 14**

## **Takeaways**

### **Keep what’s portable**

* Teach a progression: one-shot → iterate → constraints  
* Save prompts \+ parameters to reproduce results  
* Share artifacts as single-page HTML sketches  
* Treat curation as part of the creative act

Stage text:

* Save the recipe:  
  * System prompt  
  * Model \+ temperature \+ max tokens  
  * The HTML file (with a date)

---

# **Slide 15**

## **Resources**

### **Links, citations, and prompts**

* System prompts + points of departure: [prompts](https://github.com/cuny-ai-lab/creative-coding/blob/main/prompts.md)
* Slide outline: [slides](https://github.com/cuny-ai-lab/creative-coding/blob/main/slides.md)
* Models (GLM 5 / Kimi K2.5): [ailab.gc.cuny.edu/models](https://ailab.gc.cuny.edu/models/)
* Full sources list (Appendix D): [GitHub repository](https://github.com/cuny-ai-lab/creative-coding)

Sources:

* 10 PRINT CHR$(205.5+RND(1)); : GOTO 10\. MIT Press, 2012\. [https://10print.org/](https://10print.org/)  
* Goodchild, A. "Early Computer Art in the 50s & 60s." [https://www.amygoodchild.com/blog/computer-art-50s-and-60s](https://www.amygoodchild.com/blog/computer-art-50s-and-60s)  
* Noll, A. M. "The Beginnings of Generative Art." [https://ethw.org/First-Hand:The\_Beginnings\_of\_Generative\_Art](https://ethw.org/First-Hand:The_Beginnings_of_Generative_Art)  
* V\&A Museum. "Vera Molnar: Machine Imaginaire." [https://www.vam.ac.uk/blog/museum-life/vera-molnar-machine-imaginaire-the-dance-of-hands-and-machine-thinking](https://www.vam.ac.uk/blog/museum-life/vera-molnar-machine-imaginaire-the-dance-of-hands-and-machine-thinking)  
* Xu, Y. et al. "Reflection in Human–LLM Co-Creation for Creative Coding." arXiv:2402.09750, 2024\. [https://arxiv.org/html/2402.09750v2](https://arxiv.org/html/2402.09750v2)  
* Willison, S. "Not all AI-assisted programming is vibe coding." 2025\. [https://simonwillison.net/2025/Mar/19/vibe-coding/](https://simonwillison.net/2025/Mar/19/vibe-coding/)  
* Willison, S. "Useful patterns for building HTML tools with LLMs." 2025\. [https://simonwillison.net/2025/Dec/10/html-tools/](https://simonwillison.net/2025/Dec/10/html-tools/)  
* Processing Foundation. [https://processing.org/](https://processing.org/) · p5.js. [https://p5js.org/](https://p5js.org/)  
* CUNY AI Lab. [https://ailab.gc.cuny.edu/](https://ailab.gc.cuny.edu/) · Sandbox. [https://tools.ailab.gc.cuny.edu/](https://tools.ailab.gc.cuny.edu/)

