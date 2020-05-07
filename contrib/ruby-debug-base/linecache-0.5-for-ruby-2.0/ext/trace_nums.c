/*
Ruby 1.9 version: (7/20/2009, Mark Moseley, mark@fast-software.com)

   Now works with Ruby-1.9.1. Tested with p129 and p243.
   Old code remains and is #ifdef'd around.

   This does not (and can not) function identically to the 1.8 version. 
   Line numbers are ordered differently. But ruby-debug doesn't seem 
   to mind the difference.

   Also, 1.9 does not number lines with a "begin" statement.

   All this 1.9 version does is compile into bytecode, disassemble it
   using rb_iseq_disasm(), and parse the text output. This isn't a
   great solution; it will break if the disassembly format changes.
   Walking the iseq tree and decoding each instruction is pretty hairy,
   though, so until I have a really compelling reason to go that route, 
   I'll leave it at this.

   My first stab at this walked the nodes, like before, but there's no
   NODE_NEWLINE node types any more. So I just output all line numbers
   that came in, regardless of the node type, and then sorted it and
   removed dups. The problem with that approach is that Ruby 1.9 is not
   consistently sending the debugger hook RUBY_EVENT_LINE messages for
   all lines. In particular:

   1: def foo
   2:   a = 5
   3:   return a
   4: end

   The disassembly of this code doesn't have a RUBY_EVENT_LINE trace 
   message for line 3; it has it only for lines 1 and 2. Oddly, if you
   remove the "return", leaving just "a" on line 3, then you'll get the 
   trace message.

   So the advantage of this approach is that ruby-debug won't let you
   set a breakpoint on lines that don't get the trace message. I think
   it would be more confusing to be allowed to set a breakpoint, and
   never break when the line does get hit, than to be prevented to set
   the breakpoint in the first place even when you should be able to.

Ruby 1.8 version:

   This code creates module TraceLineNumbers with one method
   lnums_for_str.  lnums_for_str returns an array lines for which
   RUBY_EVENT_LINE can be called on. In other words, the line numbers
   that can be traced (such as via Tracer) or stopped at in a
   debugger (such as ruby-debug).

   This code has been tested on Ruby 1.8.6; it does not work on Ruby
   1.9.x.  The code was created via culling from various sources. 

   Ruby 1.8's eval.c, and rb_eval() in particular, is the definitive
   source of how the tree is evaluated. However we don't want to
   actually evaluate the code, which simplifies things. In contrast,
   we need lines for all branches, and not just the ones that get
   executed on a given run.  For example in an "if" node the "then"
   part may or may not get executed, but we want to get the trace line
   numbers for the "then" part regardless. 

   Code enclosed in the ***'s contains code from eval.c which is
   included for comparison.

   Also parse.y from Ruby 1.8 can shed light on how the nodes get
   created.

   Some legacy code in ParseTree is similar and necessarily more
   complex. We would have used that gem from the outside and lived
   with the additional bloat were it not broken for our purposes and
   were it not for the author's lack of interest in extending it to
   handle what's needed here.

   Finally, node_help.txt from nodewrap contains descriptions of many
   of the node types.
*/
#include <ruby.h>
#include <version.h>
#if RUBY_VERSION_MAJOR == 1 && RUBY_VERSION_MINOR == 8
#define RUBY_VERSION_1_8
#include <node.h>
#include <rubysig.h>
#else
#include <vm_core.h>
#endif
#include "trace_nums.h"

VALUE mTraceLineNumbers;

#ifdef RUBY_VERSION_1_8
RUBY_EXTERN NODE *ruby_eval_tree_begin;
RUBY_EXTERN int ruby_in_eval;

#define nd_3rd   u3.node

extern struct FRAME {
    VALUE self;
    int argc;
    ID last_func;
    ID orig_func;
    VALUE last_class;
    struct FRAME *prev;
    struct FRAME *tmp;
    struct RNode *node;
    int iter;
    int flags;
    unsigned long uniq;
} *ruby_frame;

struct METHOD {
  VALUE klass, rklass;
  VALUE recv;
  ID id, oid;
#if RUBY_VERSION_CODE > 182
  int safe_level;
#endif
  NODE *body;
};

struct BLOCK {
  NODE *var;
  NODE *body;
  VALUE self;
  struct FRAME frame;
  struct SCOPE *scope;
  VALUE klass;
  NODE *cref;
  int iter;
  int vmode;
  int flags;
  int uniq;
  struct RVarmap *dyna_vars;
  VALUE orig_thread;
  VALUE wrapper;
  VALUE block_obj;
  struct BLOCK *outer;
  struct BLOCK *prev;
};
#endif /* RUBY_VERSION_1_8 */

#define RETURN					\
  goto finish

#define EVENT_LINE(node)			\
  rb_ary_push(ary, INT2NUM(nd_line(node)))

#ifdef FINISHED
#define EVENT_CALL(node)			\
  rb_ary_push(ary, INT2NUM(nd_line(node)))
#else
#define EVENT_CALL(node)
#endif

/* Used just in debugging. */
static int indent_level = 0;

#ifdef RUBY_VERSION_1_8
static
void ln_eval(VALUE self, NODE * n, VALUE ary) {
  NODE * volatile contnode = 0;
  NODE * volatile node = n;

  if (RTEST(ruby_debug)) {
    char fmt[30] = { '\0', };
    snprintf(fmt, sizeof(fmt), "%%%ds", indent_level+1);
    fprintf(stderr, fmt, "[");
    indent_level += 2;
  }

 again:
  if (!node) RETURN;

  if (RTEST(ruby_debug)) {
    NODE *r = RNODE(node); /* For debugging */
    fprintf(stderr, "%s ", NODE2NAME[nd_type(node)]);
  }

  switch (nd_type(node)) {
  case NODE_BLOCK:
    while (node) {
      ln_eval(self, node->nd_head, ary);
      node = node->nd_next;
    }

  case NODE_POSTEXE: /* END { ... } */
    /* Nothing to do here... we are in an iter block */
    /*** 
	rb_f_END();
	nd_set_type(node, NODE_NIL); /+ exec just once +/
	result = Qnil;
    ***/
    break;

    /* begin .. end without clauses */
  case NODE_BEGIN:
    /* node for speed-up(top-level loop for -n/-p) */
    node = node->nd_body;
    goto again;

    /* nodes for speed-up(default match) */
  case NODE_MATCH:
    /* result = rb_reg_match2(node->nd_lit); */
    break;

    /* nodes for speed-up(literal match) */
  case NODE_MATCH2:
    /* l = */ ln_eval(self, node->nd_recv, ary); 
    /* r = */ ln_eval(self, node->nd_value, ary); 
    /*** result = rb_reg_match(l, r); ***/
    break;

    /* nodes for speed-up(literal match) */
  case NODE_MATCH3: /* z =~ /"#{var}"/ for example */
    /* r = */ ln_eval(self, node->nd_recv, ary);
    /* l = */ ln_eval(self, node->nd_value, ary); 
    /***
	if (TYPE(l) == T_STRING) {
	result = rb_reg_match(r, l);
	}
	else {
	// It is possible that value can be a function call which
	// can trigger an call event. So to be conservative, 
	// we have to add a line number here.
	result = rb_funcall(l, match, 1, r);
	}
    ****/
    EVENT_CALL(node);
    break;

    /* node for speed-up(top-level loop for -n/-p) */
  case NODE_OPT_N:
    /* Lots of ugliness in eval.c.  */
    ln_eval(self, node->nd_body, ary); 
    break;

  /* These nodes are empty. */
  case NODE_SELF:
  case NODE_NIL:
  case NODE_TRUE:
  case NODE_FALSE:
    RETURN /* (something) */;

  case NODE_IF:
    EVENT_LINE(node);
    ln_eval(self, node->nd_cond, ary);
    if (node->nd_body) {
      if (!node->nd_else) {
	node = node->nd_body;
	goto again;
      }
      ln_eval(self, node->nd_body, ary);
    }
    if (node->nd_else) {
      node = node->nd_else;
      goto again;
    }
    break;

  case NODE_WHEN: 
    {
      NODE *orig_node = node;
      while (node) {
	NODE *tag;
	
	if (nd_type(node) != NODE_WHEN) goto again;
	tag = node->nd_head;
	while (tag) {
	  EVENT_LINE(tag);
	  if (tag->nd_head && nd_type(tag->nd_head) == NODE_WHEN) {
	    ln_eval(self, tag->nd_head->nd_head, ary);
	  }
	  tag = tag->nd_next;
	}
	node = node->nd_next;
      }
      if (orig_node->nd_body) {
	ln_eval(self, orig_node->nd_body, ary); /* body */
      }
      RETURN /***(Qnil)***/ ;
    }

  case NODE_CASE:
    ln_eval(self, node->nd_head, ary); /* expr */
    node = node->nd_body;
    while (node) {
      NODE *tag;
      if (nd_type(node) != NODE_WHEN) {
	goto again;
      }
      tag = node->nd_head;
      while (tag) {
	EVENT_LINE(tag);
	if (tag->nd_head && nd_type(tag->nd_head) == NODE_WHEN) {
	  ln_eval(self, tag->nd_head->nd_head, ary);
	  tag = tag->nd_next;
	  continue;
	}
	ln_eval(self, tag->nd_head, ary);
	tag = tag->nd_next;
      }
      ln_eval(self, node->nd_body, ary);
      node = node->nd_next;
    }
    RETURN /***(Qnil)***/;

  case NODE_WHILE:
  case NODE_UNTIL:
    /* Doesn't follow eval.c */
    ln_eval(self, node->nd_cond, ary);
    if (node->nd_body) {
      ln_eval(self, node->nd_body, ary);
    }
    break;

  case NODE_BLOCK_PASS:
    /*** result = block_pass(self, node); ***/
    ln_eval(self, node->nd_body, ary);
    ln_eval(self, node->nd_iter, ary);
    break;

  case NODE_ITER:
  case NODE_FOR:
    ln_eval(self, node->nd_iter, ary);
    if (node->nd_var != (NODE *)1
        && node->nd_var != (NODE *)2
        && node->nd_var != NULL) {
      ln_eval(self, node->nd_var, ary);
    } 
    node = node->nd_body;
    goto again;

  case NODE_BREAK:
    /* break_jump(rb_eval(self, node->nd_stts)); */
    ln_eval(self, node->nd_stts, ary);
    break;
    
  case NODE_NEXT:
    /*** CHECK_INTS;
	 next_jump(rb_eval(self, node->nd_stts)); ***/
    ln_eval(self, node->nd_stts, ary);
    break;

  case NODE_REDO:
    /*** CHECK_INTS;
	 JUMP_TAG(TAG_REDO); ***/
    break;

  case NODE_RETRY:
    /*** CHECK_INTS;
	 JUMP_TAG(TAG_RETRY); ***/
    break;

  case NODE_SPLAT:
    /*** result = splat_value(rb_eval(self, node->nd_head)); ***/
    ln_eval(self, node->nd_head, ary);
    break;

  case NODE_TO_ARY:
    /*** result = rb_ary_to_ary(rb_eval(self, node->nd_head)); ***/
    ln_eval(self, node->nd_head, ary);
    break;

  case NODE_SVALUE:             /* a = b, c */
    /***
	result = avalue_splat(rb_eval(self, node->nd_head));
	if (result == Qundef) result = Qnil; ***/
    ln_eval(self, node->nd_head, ary);
    break;

  case NODE_YIELD:
    if (node->nd_head) {
      /*** result = rb_eval(self, node->nd_head);
	   ruby_current_node = node; else ... ***/
      ln_eval(self, node->nd_head, ary);
    }
    break;

  case NODE_RESCUE:
    /* Follow ruby_parse.rb and pray for the best. */
    ln_eval(self, node->nd_1st, ary);
    ln_eval(self, node->nd_2nd, ary);
    ln_eval(self, node->nd_3rd, ary);
    break;

  case NODE_ENSURE:
    ln_eval(self, node->nd_head, ary);
    if (node->nd_ensr) {
      ln_eval(self, node->nd_ensr, ary);
    }
    break;

  case NODE_AND:
  case NODE_OR:
    ln_eval(self, node->nd_1st, ary);
    ln_eval(self, node->nd_2nd, ary);
    break;

  case NODE_NOT:
    /*** if (RTEST(rb_eval(self, node->nd_body))) result = Qfalse;
       else result = Qtrue; ***/
    ln_eval(self, node->nd_body, ary); 
    break;

  case NODE_DOT2:
  case NODE_DOT3:
  case NODE_FLIP2:
  case NODE_FLIP3:
    ln_eval(self, node->nd_beg, ary);
    ln_eval(self, node->nd_end, ary);
    break;

  case NODE_RETURN:
    if (node->nd_stts)
      ln_eval(self, node->nd_stts, ary);
    break;

  case NODE_ARGSCAT:
  case NODE_ARGSPUSH:
    ln_eval(self, node->nd_head, ary);
    ln_eval(self, node->nd_body, ary);
    break;

  case NODE_ATTRASGN:           /* literal.meth = y u1 u2 u3 */
    /* node id node */
    if (node->nd_recv == (NODE *)1) {
      ln_eval(self, NEW_SELF(), ary);
    } else {
      ln_eval(self, node->nd_recv, ary);
    }
    ln_eval(self, node->nd_3rd, ary);
    break;
  case NODE_CALL:
  case NODE_FCALL:
  case NODE_VCALL:
    if (nd_type(node) != NODE_FCALL)
      ln_eval(self, node->nd_recv, ary);
    if (node->nd_args || nd_type(node) != NODE_FCALL)
      ln_eval(self, node->nd_args, ary);
    break;

  case NODE_SUPER:
    ln_eval(self, node->nd_args, ary);
    break;

  case NODE_ZSUPER:
    break;

  case NODE_SCOPE:
    ln_eval(self, node->nd_next, ary);
    break;

  case NODE_OP_ASGN1:
    ln_eval(self, node->nd_recv, ary);
#if RUBY_VERSION_CODE < 185
    ln_eval(self, node->nd_args->nd_next, ary);
#else
    ln_eval(self, node->nd_args->nd_2nd, ary);
#endif
    ln_eval(self, node->nd_args->nd_head, ary);
    break;

  case NODE_OP_ASGN2:
    ln_eval(self, node->nd_recv, ary);
    ln_eval(self, node->nd_value, ary);
    break;

  case NODE_OP_ASGN_AND:
  case NODE_OP_ASGN_OR:
    ln_eval(self, node->nd_head, ary);
    ln_eval(self, node->nd_value, ary);
    break;

  case NODE_MASGN:
    ln_eval(self, node->nd_head, ary);
    if (node->nd_args) {
      if (node->nd_args != (NODE *)-1) {
        ln_eval(self, node->nd_args, ary);
      }
    }
    ln_eval(self, node->nd_value, ary);
    break;

  case NODE_LASGN:
  case NODE_DASGN:
  case NODE_DASGN_CURR:
  case NODE_GASGN:
  case NODE_IASGN:
  case NODE_CDECL:
  case NODE_CVDECL:
  case NODE_CVASGN:
    ln_eval(self, node->nd_value, ary);
    break;

  case NODE_LVAR:
  case NODE_DVAR:
  case NODE_GVAR:
  case NODE_IVAR:
  case NODE_CONST:
  case NODE_CVAR:
    break;
    
  case NODE_BLOCK_ARG:        /* u1 u3 (def x(&b) */
    break;

  case NODE_COLON2:
    ln_eval(self, node->nd_head, ary);
    break;

  case NODE_COLON3:           /* u2    (::OUTER_CONST) */
    break;

  case NODE_NTH_REF:          /* u2 u3 ($1) - u3 is local_cnt('~') ignorable? */
    break;

  case NODE_BACK_REF:         /* u2 u3 ($& etc) */
    break;

  case NODE_HASH:
    {
      NODE *list;
      list = node->nd_head;
      while (list) {
        ln_eval(self, list->nd_head, ary);
        list = list->nd_next;
        if (list == 0)
          rb_bug("odd number list for Hash");
        ln_eval(self, list->nd_head, ary);
        list = list->nd_next;
      }
    }
    break;

  case NODE_ZARRAY:
    break;

  case NODE_ARRAY:
    {
      long int i = node->nd_alen;
      for (i=0; node; node=node->nd_next) {
        ln_eval(self, node->nd_head, ary);
      }
    }
    break;

  case NODE_STR:              /* u1 */
    break;

  case NODE_EVSTR: /* eval of a string */
    ln_eval(self, node->nd_2nd, ary);
    break;

  case NODE_DSTR:
  case NODE_DXSTR:
  case NODE_DREGX:
  case NODE_DREGX_ONCE:
  case NODE_DSYM:
    {
      NODE *list = node->nd_next;
      while (list) {
        if (list->nd_head) {
          switch (nd_type(list->nd_head)) {
          case NODE_STR:
            ln_eval(self, list->nd_head, ary);
            break;
          case NODE_EVSTR:
            ln_eval(self, list->nd_head, ary);
            break;
          default:
            ln_eval(self, list->nd_head, ary);
            break;
          }
        }
        list = list->nd_next;
      }
    }
    break;

  case NODE_XSTR:             /* u1    (%x{ls}) */
    /* Issues rb_funcall(self, '`'...). So I think we have to 
     register a call event. */
    EVENT_CALL(node);
    break;
    
  case NODE_LIT:
    break;

  case NODE_DEFN:
    ln_eval(self, node->nd_defn, ary);
    break;

  case NODE_DEFS:
    if (node->nd_defn) {
      ln_eval(self, node->nd_recv, ary);
    }
    ln_eval(self, node->nd_defn, ary);
    break;

  case NODE_UNDEF:            /* u2    (undef name, ...) */
#if RUBY_VERSION_CODE >= 185
    /*** ... 
	 rb_undef(ruby_class, rb_to_id(rb_eval(self, node->u2.node))); 
	 ...
    ***/
    ln_eval(self, node->u2.node, ary);
#endif
    break;

  case NODE_ALIAS:            /* u1 u2 (alias :blah :blah2) */
#if RUBY_VERSION_CODE >= 185
    ln_eval(self, node->nd_1st, ary);
    ln_eval(self, node->nd_2nd, ary);
#endif
    break;
  case NODE_VALIAS:           /* u1 u2 (alias $global $global2) */
    break;

  case NODE_CLASS:
    if (node->nd_super) {
      ln_eval(self, node->nd_super, ary);
    }
    ln_eval(self, node->nd_body, ary);
    break;

  case NODE_MODULE:
    ln_eval(self, node->nd_body, ary);
    break;

  case NODE_SCLASS:
    ln_eval(self, node->nd_recv, ary);
    ln_eval(self, node->nd_body, ary);
    break;

  case NODE_DEFINED:
    ln_eval(self, node->nd_head, ary);
    break;

  case NODE_NEWLINE:
    EVENT_LINE(node);
    node = node->nd_next;
    goto again;

  case NODE_CFUNC:
  case NODE_IFUNC:
    break;

#if RUBY_VERSION_CODE >= 190
  case NODE_ERRINFO:
  case NODE_VALUES:
  case NODE_PRELUDE:
  case NODE_LAMBDA:
    rb_warn("Ruby 1.9 is very different. You shouldn't have gotten here.");
    break;
#endif

  case NODE_BMETHOD: /* define_method (or rb_mod_define_method) with a block */
    {
      struct BLOCK *data;
      Data_Get_Struct(node->nd_cval, struct BLOCK, data);
      if (!(data->var == 0 || data->var == (NODE *)1 || 
	    data->var == (NODE *)2)) {
	/* block doesn't have args. */
        ln_eval(self, data->var, ary);
      }
      ln_eval(self, data->body, ary);
      break;
    }
    break;

#if RUBY_VERSION_CODE < 190
  case NODE_DMETHOD:
    {
      struct METHOD *data;
      Data_Get_Struct(node->nd_cval, struct METHOD, data);
      ln_eval(self, data->body, ary);
      break;
    }
#endif

  case NODE_METHOD:
    ln_eval(self, node->nd_3rd, ary);
    break;


  case NODE_ARGS: {
    if (node->nd_opt) {
      ln_eval(self, node->nd_opt, ary);
    }
  }  break;

  case NODE_ATTRSET:
    break;

  /*
  // rescue body:
  // begin stmt rescue exception => var; stmt; [rescue e2 => v2; s2;]* end
  // stmt rescue stmt
  // a = b rescue c
  // NODE_RESBODY doesn't appear in 1.8.6's rb_eval
  */
  case NODE_RESBODY:
      if (node->nd_3rd) {
        ln_eval(self, node->nd_3rd, ary);
      }
      ln_eval(self, node->nd_2nd, ary);
      ln_eval(self, node->nd_1st, ary);
    break;

  /* Nodes we found but have yet to decypher */
  /* I think these are all runtime only... not positive but... */
  case NODE_MEMO:               /* enum.c zip */
  case NODE_CREF:
  /* #defines: */
  /* case NODE_LMASK: */
  /* case NODE_LSHIFT: */

  default:
    rb_warn("Unhandled node '%s'", NODE2NAME[nd_type(node)]);
    if (RNODE(node)->u1.node != NULL) rb_warning("unhandled u1 value");
    if (RNODE(node)->u2.node != NULL) rb_warning("unhandled u2 value");
    if (RNODE(node)->u3.node != NULL) rb_warning("unhandled u3 value");
    if (RTEST(ruby_debug)) 
      fprintf(stderr, "u1 = %p u2 = %p u3 = %p\n", 
	      (void*)node->nd_1st, (void*)node->nd_2nd, (void*)node->nd_3rd);
    break;
  }
  finish:
    if (contnode) {
	node = contnode;
	contnode = 0;
	goto again;
    }
    if (RTEST(ruby_debug)) {
      char fmt[30] = { '\0', };
      indent_level -= 2;
      snprintf(fmt, sizeof(fmt), "%%%ds", indent_level+1);
      fprintf(stderr, fmt, "]\n");
    }

} /* ln_eval */
#endif /* RUBY_VERSION_1_8 */

/* Return a list of trace hook line numbers for the string in Ruby source src*/
static VALUE 
lnums_for_str(VALUE self, VALUE src) {
  VALUE result = rb_ary_new(); /* The returned array of line numbers. */
#ifdef RUBY_VERSION_1_8
  NODE *node = NULL;
  int critical;
#else
  int len;
  char *token;
  char *disasm;
  rb_thread_t *th;
  VALUE iseqval;
  VALUE disasm_val;
#endif

  StringValue(src); /* Check that src is a string. */

  if (RTEST(ruby_debug)) {
    indent_level = 0;
  }

#ifdef RUBY_VERSION_1_8
  ruby_nerrs = 0;
  critical = rb_thread_critical;
  rb_thread_critical = Qtrue;

  /* Making ruby_in_eval nonzero signals rb_compile_string not to save
     source in SCRIPT_LINES__. */
  ruby_in_eval++; 
  node = rb_compile_string("(numbers_for_str)", src, 1);
  ruby_in_eval--;

  rb_thread_critical = critical;

  if (ruby_nerrs > 0) {
    ruby_nerrs = 0;
    ruby_eval_tree_begin = 0;
    rb_exc_raise(ruby_errinfo);
  }

  ln_eval(self, node, result);

#else
  th = GET_THREAD();

  /* First compile to bytecode, using the method in eval_string_with_cref() in vm_eval.c */
  th->parse_in_eval++;
  th->mild_compile_error++;
  iseqval = rb_iseq_compile(src, rb_str_new_cstr("(numbers_for_str)"), INT2FIX(1));
  th->mild_compile_error--;
  th->parse_in_eval--;

  /* Disassemble the bytecode into text and parse into lines */
  disasm_val = rb_iseq_disasm(iseqval);
  if (disasm_val == Qnil)
    return(result);

  disasm = (char*)malloc(strlen(RSTRING_PTR(disasm_val))+1);
  strcpy(disasm, RSTRING_PTR(disasm_val));

  for (token = strtok(disasm, "\n"); token != NULL; token = strtok(NULL, "\n")) {

    /* look only for lines tracing RUBY_EVENT_LINE (1) */
    if (strstr(token, "trace            1 ") == NULL)
      continue;
    len = strlen(token) - 1;
    if (token[len] != ')') 
      continue;
    len--;
    if ((token[len] == '(') || (token[len] == ' '))
      continue;
      
    for (; len > 0; len--) {
      if (token[len] == ' ') 
        continue;
      if ((token[len] >= '0') && (token[len] <= '9')) 
        continue;
      if (token[len] == '(')
        rb_ary_push(result, INT2NUM(atoi(token + len + 1))); /* trace found */

      break;
    }

  }

  free(disasm);

#endif

  return result;
}

void Init_trace_nums(void)
{
    mTraceLineNumbers = rb_define_module("TraceLineNumbers");
    rb_define_module_function(mTraceLineNumbers, "lnums_for_str", 
			      lnums_for_str, 1);
}
