# My Software Engineering Journey: What I Learned About Myself

**Date:** December 13, 2024  
**Author:** Victor Dixon  
**Category:** Personal Development, Software Engineering

---

## Introduction

Recently, I conducted a comprehensive security audit of my portfolio projects. What started as a routine check turned into a profound learning experience about my strengths, weaknesses, and growth as a developer. This is my honest reflection on what I discovered.

---

## The Audit That Changed Everything

I decided to audit all my websites and projects for security vulnerabilities, performance issues, and code quality. I wanted to make sure my work was professional-grade before showcasing it. What I found was both humbling and enlightening.

### What I Discovered

**Critical Issues Found:**
- API authentication vulnerability (a function that always returned `true` - oops!)
- SQL queries without prepared statements
- Missing rate limiting on API endpoints
- API keys logged in plain text

**Code Quality Issues:**
- No unit tests
- Documentation could be better
- Performance optimization needed
- Some best practices not followed

At first, I was disappointed. But then I realized: **this is exactly what I needed to see.**

---

## What I Learned About Myself

### 1. I Have Good Awareness, But Need Better Implementation

**The Good:**
- I knew security was important
- I used WordPress security functions (sanitization, escaping)
- I understood the concepts

**The Reality:**
- I didn't always implement them correctly
- I missed some critical vulnerabilities
- I didn't follow all best practices

**The Lesson:**
Knowing about security isn't enough. You have to implement it correctly, test it, and review it regularly. Awareness without proper implementation is just theoretical knowledge.

---

### 2. I'm Good at Building, But Need to Focus on Quality

**The Good:**
- I can build complete projects from scratch
- I solve complex problems (game AI, multi-API integration)
- I ship working code

**The Reality:**
- Working code isn't always secure code
- Functional doesn't mean production-ready
- I need to focus more on quality over speed

**The Lesson:**
Building fast is great, but building securely and maintainably is better. I need to slow down and think about security, testing, and best practices from the start.

---

### 3. I Learn Best by Doing (And Making Mistakes)

**The Process:**
1. I built projects
2. I audited them
3. I found issues
4. I'm fixing them
5. I'm learning from the process

**The Insight:**
I don't learn well from just reading documentation. I learn by building, making mistakes, finding them, and fixing them. This audit process was one of my best learning experiences.

**The Lesson:**
Don't be afraid to audit your own work. Finding vulnerabilities in your code isn't failure - it's growth. The failure would be not looking for them.

---

### 4. I Have Strong Problem-Solving Skills

**What I'm Good At:**
- Complex game logic (Tetris AI, board evaluation)
- Multi-API integration with fallback mechanisms
- Building complete systems from scratch
- Algorithm design

**The Reality:**
My problem-solving skills are solid. I can tackle complex challenges. But I need to apply the same rigor to security, testing, and best practices.

**The Lesson:**
Apply your problem-solving skills to all aspects of development, not just the fun parts. Security is a problem to solve. Testing is a problem to solve. Documentation is a problem to solve.

---

### 5. I'm Honest About My Skill Level (And That's a Strength)

**The Honest Assessment:**
- I'm an intermediate developer, not advanced
- I have strengths (game dev, WordPress basics, problem-solving)
- I have weaknesses (security implementation, testing, best practices)
- I'm actively learning and improving

**Why This Matters:**
Being honest about where you are is the first step to getting where you want to be. I could have pretended to be more skilled, but that wouldn't help me grow.

**The Lesson:**
Self-awareness is a superpower. Knowing your weaknesses means you can work on them. Pretending you don't have any means you'll never improve.

---

## My Improvement Plan

Based on what I learned, I created a concrete improvement plan:

### Immediate (This Week):
1. Fix the critical security vulnerabilities
2. Implement SQL prepared statements
3. Add rate limiting
4. Mask API keys in logs

### Short Term (This Month):
1. Learn and implement testing (PHPUnit, Jest)
2. Improve documentation (JSDoc, PHPDoc)
3. Follow WordPress coding standards
4. Add security headers

### Long Term (Next 3 Months):
1. Write comprehensive tests
2. Optimize performance
3. Create API documentation
4. Set up CI/CD with testing

---

## The Mindset Shift

### Before the Audit:
- "My code works, that's what matters"
- "I'll add security later"
- "Testing is for big projects"
- "Documentation can wait"

### After the Audit:
- "My code needs to be secure AND work"
- "Security is part of the development process"
- "Testing helps me write better code"
- "Documentation helps me and others understand the code"

---

## What This Means for My Career

### Honest Self-Assessment:
I'm not a senior developer yet. I'm intermediate, and that's okay. I have:
- Strong problem-solving skills
- Good foundation in JavaScript and WordPress
- Ability to build complete projects
- Willingness to learn and improve

### Growth Areas:
I need to focus on:
- Security best practices
- Testing and quality assurance
- Performance optimization
- Following industry standards

### The Path Forward:
1. Continue building projects
2. Audit and improve them
3. Learn from mistakes
4. Apply best practices
5. Share what I learn

---

## Key Takeaways

1. **Self-Audit is Essential:** Regularly audit your own code. You'll find issues, and that's good.

2. **Awareness ≠ Implementation:** Knowing about security isn't enough. You have to implement it correctly.

3. **Honesty is Strength:** Being honest about your skill level helps you grow. Pretending doesn't.

4. **Mistakes are Learning:** Finding vulnerabilities in your code isn't failure - it's growth.

5. **Continuous Improvement:** There's always something to learn and improve. Embrace it.

6. **Process Matters:** Building fast is great, but building securely and maintainably is better.

---

## Conclusion

This security audit was one of the most valuable learning experiences I've had. It showed me:
- Where I'm strong (problem-solving, building)
- Where I need to improve (security, testing, best practices)
- How to grow (audit, learn, implement, repeat)

I'm not perfect, and that's okay. I'm learning, improving, and building better code every day. And that's what matters.

---

## Resources That Helped Me

- WordPress Security Handbook
- OWASP Top 10
- WordPress Coding Standards
- PHPUnit Documentation
- Jest Documentation

---

**Next Steps:**
- Fix the identified vulnerabilities
- Implement the improvement plan
- Continue learning and growing
- Share the journey

---

*This blog post is part of my commitment to honest self-reflection and continuous improvement as a developer.*

---

**About the Author:**
Victor Dixon is a full-stack developer specializing in WordPress development and JavaScript game programming. He's currently focused on improving security practices, testing, and code quality. You can find his projects on GitHub: github.com/Victor-Dixon

