<critical_notes>
## MISSION CRITICAL RULES
1. **Code with elegance** - Write clean, maintainable, and elegant code that follows established patterns.
2. **Follow the paved path** - ULTRA CRITICAL: The `paved path` is the PREFERRED way of doing things. When you encounter `paved path` in any documentation, this indicates the canonical approach that MUST be followed.
3. **Type safety is mandatory** - NEVER use `any` types. If you believe `any` is necessary, PAUSE and request explicit user approval, even in auto-accept mode.
4. **User runs the application** - Unless you are running a QA command, you do not run the app. Always ask the user to run the app and report results back to you.
5. **Clarify ambiguity** - Favor asking follow-up questions to ensure clear understanding of requirements before implementation.
6. **Preserve existing functionality** - NEVER reduce the scope of existing features/behaviors unless explicitly instructed to do so.
7. **keep updating all CLAUDE.md files- it is a living documentation**
 - ULTRA CRITICAL: Treat all CLAUDE.md files as living API documentation for your future self. Always check for relevant CLAUDE.md files and DEFINITELY UPDATE them when changes impact their accuracy.
8. **Add good comments everywhere** -  add comments in your code to make it better documented. definitely add a one line comment in each file saying what it does and another comment on each function or class saying what it does. when using  external functions and  external libraries , then add a small 4-5 word comment on what it does as well
</critical_notes>


<super_important>
- KEEP ADDING TEST CASES and after every step suggest what tests cases to run and debug accordingly
</super_important>
